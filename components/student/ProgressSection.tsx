"use client"; // Required for Next.js App Router (if using App directory)

import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import type { TooltipItem } from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip);

const ProgressSection = () => {
  // ✅ Mock progress data (could later come from an API)
  const [progressData] = useState([40, 50, 60, 75, 83]); // Example: Weekly progress

  useEffect(() => {
    // In a real app, fetch progress data here
  }, []);

  // ✅ Chart Data Configuration
  const data = {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"],
    datasets: [
      {
        label: "Progress Over Time",
        data: progressData,
        fill: false,
        borderColor: "#3B82F6",
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#3B82F6",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false } },
      y: { min: 0, max: 100, ticks: { stepSize: 20 } },
    },
    plugins: {
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context: TooltipItem<"line">) => `Progress: ${context.raw}%`,
        },
      },
    },
  };

  // ✅ Dynamic Message Based on Progress
  const latestProgress = progressData[progressData.length - 1];
  let progressMessage = "Keep going!";
  if (latestProgress < 50) progressMessage = "You can improve! Try completing a lesson today.";
  else if (latestProgress < 80) progressMessage = "Great job! Stay consistent.";
  else progressMessage = "🔥 Amazing! You're almost there!";

  return (
    <div className="bg-white p-6 shadow-md rounded-xl text-center">
      <h2 className="text-xl font-semibold text-gray-800 mb-3">Your Learning Progress</h2>
      
      {/* ✅ Dynamic Next Step Message */}
      <p className="text-gray-500">{progressMessage}</p>

      {/* ✅ Line Chart */}
      <div className="w-full h-40 mt-4">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

export default ProgressSection;