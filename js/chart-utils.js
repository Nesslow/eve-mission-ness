/**
 * Chart Utilities for EVE Mission Tracker
 * Creates and manages Chart.js visualizations
 */

const ChartUtils = (() => {
  // References to chart instances
  let earningsChart = null;
  let missionComparisonChart = null;
  
  /**
   * Create the earnings over time chart
   */
  function createEarningsChart(missions) {
    // Clean up previous chart if it exists
    if (earningsChart) {
      earningsChart.destroy();
    }
    
    // Get canvas element
    const ctx = document.getElementById('earnings-chart').getContext('2d');
    
    // Prepare data
    const chartData = prepareEarningsChartData(missions);
    
    // Create chart
    earningsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [
          {
            label: 'ISK per Hour',
            data: chartData.iskPerHour,
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Profit per Mission',
            data: chartData.profit,
            borderColor: '#2ecc71',
            backgroundColor: 'rgba(46, 204, 113, 0.1)',
            tension: 0.4,
            fill: true,
            hidden: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += formatISK(context.parsed.y);
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            title: {
              display: true,
              text: 'ISK'
            },
            ticks: {
              callback: function(value) {
                return formatISK(value);
              }
            }
          }
        }
      }
    });
    
    return earningsChart;
  }

  /**
   * Prepare data for earnings chart
   */
  function prepareEarningsChartData(missions) {
    if (!missions || missions.length === 0) {
      return { labels: [], iskPerHour: [], profit: [] };
    }
    
    // Sort missions by date
    const sortedMissions = [...missions].sort((a, b) => {
      return new Date(a.date) - new Date(b.date);
    });
    
    // Group missions by date
    const missionsByDate = {};
    
    sortedMissions.forEach(mission => {
      if (!missionsByDate[mission.date]) {
        missionsByDate[mission.date] = [];
      }
      missionsByDate[mission.date].push(mission);
    });
    
    // Calculate average ISK/hr for each date
    const labels = [];
    const iskPerHour = [];
    const profit = [];
    
    Object.keys(missionsByDate).sort().forEach(date => {
      const dateMissions = missionsByDate[date];
      
      // Calculate average ISK/hr for this date
      const totalIskPerHour = dateMissions.reduce((sum, mission) => {
        return sum + (mission.iskPerHour || 0);
      }, 0);
      
      const avgIskPerHour = totalIskPerHour / dateMissions.length;
      
      // Calculate average profit for this date
      const totalProfit = dateMissions.reduce((sum, mission) => {
        const income = 
          (mission.income.bounties || 0) + 
          (mission.income.missionReward || 0) + 
          (mission.income.timeBonus || 0) + 
          (mission.income.lootValue || 0);
        
        const expenses = 
          (mission.expenses.ammo || 0) + 
          (mission.expenses.repairs || 0) + 
          (mission.expenses.other || 0);
        
        return sum + (income - expenses);
      }, 0);
      
      const avgProfit = totalProfit / dateMissions.length;
      
      // Format date for display (MM/DD)
      const dateObj = new Date(date);
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();
      const formattedDate = `${month}/${day}`;
      
      labels.push(formattedDate);
      iskPerHour.push(avgIskPerHour);
      profit.push(avgProfit);
    });
    
    return { labels, iskPerHour, profit };
  }

  /**
   * Create the mission comparison chart
   */
  function createMissionComparisonChart(missions) {
    // Clean up previous chart if it exists
    if (missionComparisonChart) {
      missionComparisonChart.destroy();
    }
    
    // Get canvas element
    const ctx = document.getElementById('mission-comparison-chart').getContext('2d');
    
    // Prepare data
    const chartData = prepareMissionComparisonData(missions);
    
    // Create chart
    missionComparisonChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: [
          {
            label: 'Average ISK per Hour',
            data: chartData.iskPerHour,
            backgroundColor: chartData.colors
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = 'ISK per Hour: ';
                if (context.parsed.x !== null) {
                  label += formatISK(context.parsed.x);
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'ISK per Hour'
            },
            ticks: {
              callback: function(value) {
                return formatISK(value);
              }
            }
          }
        }
      }
    });
    
    return missionComparisonChart;
  }

  /**
   * Prepare data for mission comparison chart
   */
  function prepareMissionComparisonData(missions) {
    if (!missions || missions.length === 0) {
      return { labels: [], iskPerHour: [], colors: [] };
    }
    
    // Group missions by name
    const missionsByName = {};
    
    missions.forEach(mission => {
      if (!mission.missionName) return;
      
      if (!missionsByName[mission.missionName]) {
        missionsByName[mission.missionName] = [];
      }
      missionsByName[mission.missionName].push(mission);
    });
    
    // Calculate average ISK/hr for each mission type
    const missionData = [];
    
    Object.keys(missionsByName).forEach(name => {
      const missions = missionsByName[name];
      
      // Only include missions with at least 2 data points
      if (missions.length < 1) return;
      
      // Calculate average ISK/hr
      const totalIskPerHour = missions.reduce((sum, mission) => {
        return sum + (mission.iskPerHour || 0);
      }, 0);
      
      const avgIskPerHour = totalIskPerHour / missions.length;
      
      missionData.push({
        name: name,
        iskPerHour: avgIskPerHour,
        count: missions.length
      });
    });
    
    // Sort by ISK/hr (descending)
    missionData.sort((a, b) => b.iskPerHour - a.iskPerHour);
    
    // Take top 10
    const topMissions = missionData.slice(0, 10);
    
    // Prepare chart data
    const labels = topMissions.map(m => `${m.name} (${m.count})`);
    const iskPerHour = topMissions.map(m => m.iskPerHour);
    
    // Generate colors based on ISK/hr
    const maxIsk = Math.max(...iskPerHour);
    const colors = iskPerHour.map(isk => {
      const ratio = isk / maxIsk;
      return `rgba(46, 204, 113, ${0.3 + ratio * 0.7})`;
    });
    
    return { labels, iskPerHour, colors };
  }

  /**
   * Format ISK value with abbreviations
   */
  function formatISK(value) {
    if (typeof value !== 'number') {
      return '0 ISK';
    }
    
    if (value >= 1000000000) {
      return (value / 1000000000).toFixed(2) + ' B ISK';
    } else if (value >= 1000000) {
      return (value / 1000000).toFixed(2) + ' M ISK';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(2) + ' K ISK';
    } else {
      return value.toFixed(0) + ' ISK';
    }
  }

  // Public API
  return {
    createEarningsChart,
    createMissionComparisonChart
  };
})();