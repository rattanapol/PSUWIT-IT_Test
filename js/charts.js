/**
 * ระบบแสดงผลกราฟใยแมงมุม (Spider / Radar Chart & Analytics)
 * ขับเคลื่อนด้วย Chart.js แสดงสมรรถนะ IT ทั้ง 6 ด้าน พร้อมเปรียบเทียบ Pre-test vs Post-test
 */

const AssessmentCharts = {
  activeRadarChart: null,
  activeAdminChart: null,

  // แปลงคีย์ D1-D6 เป็นป้ายชื่อภาษาไทย
  getDomainLabels() {
    return [
      "การรู้เท่าทันดิจิทัล (D1)",
      "ฮาร์ดแวร์ & เครือข่าย (D2)",
      "การคิดคำนวณ & โค้ด (D3)",
      "การจัดการข้อมูล (D4)",
      "ความมั่นคงไซเบอร์ (D5)",
      "AI & เทคโนโลยีใหม่ (D6)"
    ];
  },

  // สร้างหรืออัปเดตกราฟใยแมงมุมเดี่ยวหรือเปรียบเทียบ Pre vs Post
  renderRadarChart(canvasId, currentResult, previousResult = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (typeof Chart === "undefined") {
      console.warn("Chart.js ยังไม่ได้ถูกโหลดหรือทำงานแบบออฟไลน์");
      return;
    }

    if (this.activeRadarChart) {
      this.activeRadarChart.destroy();
      this.activeRadarChart = null;
    }

    const labels = this.getDomainLabels();
    const currentData = [
      currentResult.domain_scores?.D1 || 0,
      currentResult.domain_scores?.D2 || 0,
      currentResult.domain_scores?.D3 || 0,
      currentResult.domain_scores?.D4 || 0,
      currentResult.domain_scores?.D5 || 0,
      currentResult.domain_scores?.D6 || 0
    ];

    const datasets = [];

    // หากมีข้อมูลรอบก่อนหน้า (เช่น มีทั้ง Pre-test และ Post-test)
    if (previousResult) {
      const prevData = [
        previousResult.domain_scores?.D1 || 0,
        previousResult.domain_scores?.D2 || 0,
        previousResult.domain_scores?.D3 || 0,
        previousResult.domain_scores?.D4 || 0,
        previousResult.domain_scores?.D5 || 0,
        previousResult.domain_scores?.D6 || 0
      ];

      datasets.push({
        label: `${previousResult.test_type} (${previousResult.score_percent}%)`,
        data: prevData,
        backgroundColor: "rgba(245, 158, 11, 0.25)",
        borderColor: "#F59E0B",
        borderWidth: 2,
        pointBackgroundColor: "#F59E0B",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "#F59E0B",
        pointRadius: 4
      });
    }

    // ข้อมูลรอบปัจจุบัน
    const isPost = currentResult.test_type === "Post-test";
    const mainColor = isPost ? "#10B981" : "#4F46E5";
    const mainBg = isPost ? "rgba(16, 185, 129, 0.25)" : "rgba(79, 70, 229, 0.25)";

    datasets.push({
      label: `${currentResult.test_type} (${currentResult.score_percent}%)`,
      data: currentData,
      backgroundColor: mainBg,
      borderColor: mainColor,
      borderWidth: 2.5,
      pointBackgroundColor: mainColor,
      pointBorderColor: "#fff",
      pointHoverBackgroundColor: "#fff",
      pointHoverBorderColor: mainColor,
      pointRadius: 5
    });

    const ctx = canvas.getContext("2d");
    this.activeRadarChart = new Chart(ctx, {
      type: "radar",
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              font: { family: "'Prompt', sans-serif", size: 13, weight: "500" },
              color: "#334155"
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${context.raw}%`
            }
          }
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              display: true,
              backdropColor: "transparent",
              color: "#94A3B8",
              font: { size: 10 }
            },
            grid: {
              color: "rgba(203, 213, 225, 0.6)"
            },
            angleLines: {
              color: "rgba(203, 213, 225, 0.6)"
            },
            pointLabels: {
              font: {
                family: "'Prompt', sans-serif",
                size: 11,
                weight: "600"
              },
              color: "#1E293B"
            }
          }
        }
      }
    });
  },

  // กราฟแท่งสำหรับ Admin Dashboard แสดงคะแนนเฉลี่ยแยกตามระดับชั้น ม.1 - ม.6
  renderAdminOverviewChart(canvasId, assessments) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (typeof Chart === "undefined") {
      console.warn("Chart.js ยังไม่ได้ถูกโหลดหรือทำงานแบบออฟไลน์");
      return;
    }

    if (this.activeAdminChart) {
      this.activeAdminChart.destroy();
      this.activeAdminChart = null;
    }

    const grades = APP_CONFIG.gradeLevels;
    const preAverages = [];
    const postAverages = [];

    grades.forEach((grade) => {
      const preList = assessments.filter((a) => a.grade === grade && a.test_type === "Pre-test");
      const postList = assessments.filter((a) => a.grade === grade && a.test_type === "Post-test");

      const preAvg = preList.length ? Math.round(preList.reduce((acc, c) => acc + Number(c.score_percent || 0), 0) / preList.length) : 0;
      const postAvg = postList.length ? Math.round(postList.reduce((acc, c) => acc + Number(c.score_percent || 0), 0) / postList.length) : 0;

      preAverages.push(preAvg);
      postAverages.push(postAvg);
    });

    const ctx = canvas.getContext("2d");
    this.activeAdminChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: grades,
        datasets: [
          {
            label: "คะแนนเฉลี่ย Pre-test (%)",
            data: preAverages,
            backgroundColor: "rgba(79, 70, 229, 0.8)",
            borderRadius: 6
          },
          {
            label: "คะแนนเฉลี่ย Post-test (%)",
            data: postAverages,
            backgroundColor: "rgba(16, 185, 129, 0.85)",
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { font: { family: "'Prompt', sans-serif", size: 12 } }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              callback: (val) => val + "%"
            }
          }
        }
      }
    });
  }
};

if (typeof window !== "undefined") {
  window.AssessmentCharts = AssessmentCharts;
}
