"use client"; // Required for App Router hooks

import React, { useState } from "react";

interface Task {
  id: number;
  title: string;
  completed: boolean;
  progress?: string;
}

interface TaskListProps {
  tasks: Task[];
}

const TaskList: React.FC<TaskListProps> = ({ tasks }) => {
  const [taskList, setTaskList] = useState(tasks); // ✅ State to track tasks

  const toggleTask = (taskId: number) => {
    setTaskList((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  };

  return (
    <div className="bg-[#FFFFE] border border-[#E5FCF5] rounded-lg p-6">
      <h2 className="text-xl font-semibold text-[#13293D] mb-4 flex items-center">
        Tasks
      </h2>
      <ul className="space-y-2">
        {taskList.map((task) => (
          <li
            key={task.id}
            className={`group flex items-center justify-between p-3 rounded-md transition-colors duration-200 border border-transparent ${task.completed 
              ? 'bg-[#E5FCF5] border-[#E5FCF5]' 
              : 'hover:bg-[#E5FCF5]/30 hover:border-[#E5FCF5]'}`}
          >
            <div className="flex items-center flex-1 min-w-0">
              <div 
                className={`relative w-4 h-4 border rounded mr-3 cursor-pointer transition-colors duration-200 ${task.completed 
                  ? 'border-[#006494] bg-[#006494]' 
                  : 'border-[#247BA0] group-hover:border-[#006494]'}`}
                onClick={() => toggleTask(task.id)}
              >
                {task.completed && (
                  <svg 
                    className="absolute inset-0 w-full h-full text-white stroke-2" 
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path 
                      d="M5 13l4 4L19 7" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span
                className={`text-[#13293D] transition-colors duration-200 truncate ${task.completed 
                  ? 'line-through text-[#247BA0]/70' 
                  : 'group-hover:text-[#006494]'}`}
              >
                {task.title}
              </span>
            </div>
            {task.progress && (
              <span className="text-[#247BA0] text-sm ml-4">
                {task.progress}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TaskList;