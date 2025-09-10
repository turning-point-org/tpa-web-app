"use client";

import React, { useState, useEffect } from 'react';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import { Download } from 'lucide-react';

// Define interfaces for process groups and pain points
export interface ProcessGroup {
  name: string;
  description?: string;
  score?: number;
  processes?: any[];
  strategicObjectives?: { name: string; score: number }[];
  costToServe?: number;
  painPoints?: PainPoint[]; // Add pain points property
}

// Define interface for pain points
export interface PainPoint {
  id: string;
  name: string;
  description: string;
  assigned_process_group?: string;
  cost_to_serve?: number;
  // Strategic objective properties are prefixed with so_
  [key: string]: any; // To allow strategic objective properties (so_*)
}

// Interface for props
interface DetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lifecycleName: string;
  categoryName: string;
  processGroups?: ProcessGroup[];
  categoryCostToServe?: number;
  initialExpandedGroupId?: string | null;
}

// Function to generate CSV data
const generateCSVData = (lifecycleName: string, categoryName: string, processGroups: ProcessGroup[]) => {
  const csvRows = [];
  
  // Add header row
  csvRows.push([
    'Lifecycle',
    'Journey',
    'Process Group',
    'Process Group Description',
    'Process Group Score',
    'Pain Point Name',
    'Pain Point Description',
    'Pain Point Total Score',
    'Strategic Objectives'
  ]);
  
  // Add data rows
  processGroups.forEach(group => {
    const painPoints = group.painPoints || [];
    
    if (painPoints.length === 0) {
      // If no pain points, add a row for the process group only
      csvRows.push([
        lifecycleName,
        categoryName,
        group.name,
        group.description || '',
        group.score || 0,
        '',
        '',
        '',
        ''
      ]);
    } else {
      // Add a row for each pain point
      painPoints.forEach(painPoint => {
        // Calculate total strategic objective score
        const totalScore = Object.entries(painPoint)
          .filter(([key, value]) => key.startsWith('so_') && typeof value === 'number')
          .reduce((total, [_, value]) => total + (value as number), 0);
        
        // Format strategic objectives
        const strategicObjectives = Object.entries(painPoint)
          .filter(([key, value]) => key.startsWith('so_') && typeof value === 'number' && value > 0)
          .map(([key, value]) => {
            const objName = key.replace('so_', '')
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            let label = 'Low';
            if (value === 2) label = 'Med';
            else if (value >= 3) label = 'High';
            return `${objName}: ${label} (${value})`;
          })
          .join('; ');
        
        csvRows.push([
          lifecycleName,
          categoryName,
          group.name,
          group.description || '',
          group.score || 0,
          painPoint.name || '',
          painPoint.description || '',
          totalScore,
          strategicObjectives
        ]);
      });
    }
  });
  
  return csvRows;
};

// Function to download CSV
const downloadCSV = (csvData: string[][], filename: string) => {
  // Convert array to CSV string
  const csvContent = csvData.map(row => 
    row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',')
  ).join('\n');
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Modal Component for Process Category Details
function DetailsModalComponent({ 
  isOpen, 
  onClose, 
  lifecycleName, 
  categoryName,
  processGroups = [],
  categoryCostToServe = 0,
  initialExpandedGroupId = null
}: DetailsModalProps) {
  // Move conditional rendering to the return statement instead of early return
  // Always declare hooks at the top level

  // Calculate total points for all process groups
  const totalPoints = processGroups.reduce((total, group) => total + (group.score || 0), 0);
  
  // State to track expanded process groups - initialize with the clicked group if provided
  const [expandedGroups, setExpandedGroups] = useState<{[key: string]: boolean}>(() => {
    if (initialExpandedGroupId) {
      return { [initialExpandedGroupId]: true };
    }
    return {};
  });
  
  // State to track expanded pain points sections
  const [expandedPainPointSections, setExpandedPainPointSections] = useState<{[key: string]: boolean}>({});
  
  // State to track expanded individual pain points
  const [expandedPainPoints, setExpandedPainPoints] = useState<{[key: string]: boolean}>({});
  
  // Update expanded groups when initialExpandedGroupId changes
  useEffect(() => {
    if (initialExpandedGroupId) {
      setExpandedGroups(prev => ({
        ...prev,
        [initialExpandedGroupId]: true
      }));
    }
  }, [initialExpandedGroupId]);
  
  // Function to toggle a process group expansion
  const toggleProcessGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };
  
  // Function to toggle a pain points section expansion
  const togglePainPointsSection = (groupId: string) => {
    setExpandedPainPointSections(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };
  
  // Function to toggle a specific pain point
  const togglePainPoint = (painPointId: string) => {
    setExpandedPainPoints(prev => ({
      ...prev,
      [painPointId]: !prev[painPointId]
    }));
  };

  // Function to handle CSV export
  const handleExportCSV = () => {
    const csvData = generateCSVData(lifecycleName, categoryName, processGroups);
    const filename = `${lifecycleName}-${categoryName}-processes-and-pain-points.csv`;
    downloadCSV(csvData, filename);
  };

  // Return null conditionally here instead of early return
  if (!isOpen) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="3xl" title="">
      <div className="py-2 relative">
        {/* Header buttons */}
        <div className="absolute top-0 right-0 flex space-x-2">
          {/* Export CSV button */}
          <button 
            onClick={handleExportCSV}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 flex items-center"
            aria-label="Export to CSV"
            title="Export to CSV"
          >
            <Download className="w-5 h-5" />
          </button>
          
          {/* Close button */}
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Custom header with lifecycle tag and category title */}
        <div className="mb-6">
          <div className="mb-1 text-left">
            <span 
              className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
              style={{ backgroundColor: '#6B7280' }}
            >
              {lifecycleName}
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 text-left mb-1">
            {categoryName}
          </h2>
          <p className="text-sm text-gray-500 text-left">Journey</p>
        </div>
        
        {/* Header with metrics */}
        <div className="mb-6 text-left">
          <div className="flex space-x-2 mb-4">
            <span 
              className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
              style={{ backgroundColor: '#0EA394' }}
              title="Total points across all process groups"
            >
              {totalPoints} pts
            </span>
          </div>
          
          <h4 className="text-sm font-medium text-gray-500 mb-1 text-left">Description</h4>
          <p className="text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-200 text-sm text-left">
            {categoryName} process category in the {lifecycleName} lifecycle.
          </p>
        </div>
        
        {/* Process Groups Section with Accordion */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2 text-left">
            Processes ({processGroups.length})
          </h4>
          
          {processGroups.length === 0 ? (
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 text-left">
              <p className="text-gray-500">No processes found for this category.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {processGroups.map((group, index) => {
                const score = typeof group.score === 'number' ? group.score : 0;
                const strategicObjectives = group.strategicObjectives || [];
                // Create a unique ID for each group
                const groupId = `group-${index}`;
                const isExpanded = expandedGroups[groupId] || false;
                const isPainPointsSectionExpanded = expandedPainPointSections[groupId] || false;
                
                // Get pain points assigned to this group
                const assignedPainPoints = group.painPoints || [];
                const hasPainPoints = assignedPainPoints.length > 0;
                
                return (
                  <div 
                    key={index} 
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                  >
                    {/* Collapsible header */}
                    <div 
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleProcessGroup(groupId)}
                    >
                      <div className="flex items-center">
                        <Button
                          variant="primary"
                          className="mr-1 p-0 border-0 shadow-none min-w-[16px] min-h-[16px] w-4 h-4 text-black"
                          iconOnly
                          colorOverride="transparent"
                          icon={
                            <svg 
                              className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
                              fill="none" 
                              stroke="black" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          }
                        />
                        <h3 className="text-lg font-medium text-gray-800 text-left">{group.name}</h3>
                      </div>
                      
                      <div className="flex space-x-2">
                        <span 
                          className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold"
                          style={{ backgroundColor: '#0EA394' }}
                          title="Process group score"
                        >
                          {score} pts
                        </span>
                      </div>
                    </div>
                    
                    {/* Collapsible content */}
                    {isExpanded && (
                      <div className="p-4 pt-0 border-t border-gray-100">
                        {/* Group Description */}
                        {group.description ? (
                          <div className="mb-3 pt-3">
                            <h4 className="text-xs font-medium text-gray-500 mb-1 text-left">Description</h4>
                            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded-md border border-gray-100 text-left">
                              {group.description}
                            </p>
                          </div>
                        ) : null}
                        
                        {/* Strategic Objectives section */}
                        {strategicObjectives && strategicObjectives.length > 0 && (
                          <div className="mt-3">
                            <h4 className="text-xs font-medium text-gray-500 mb-1 text-left">Strategic Objectives Impact</h4>
                            <div className="bg-gray-50 p-2 rounded-md border border-gray-100">
                              <div className="flex flex-wrap gap-2">
                                {strategicObjectives.map((obj, idx) => (
                                  <div 
                                    key={idx} 
                                    className="flex items-center bg-white rounded px-2 py-1 border border-gray-200"
                                  >
                                    <span className="text-xs text-gray-700 text-left">{obj.name}</span>
                                    <span className="ml-1.5 inline-block px-1.5 py-0.5 bg-[#0EA394] text-white text-xs rounded-full">
                                      {obj.score}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Pain Points Section */}
                        <div className="mt-4">
                          <div 
                            className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePainPointsSection(groupId);
                            }}
                          >
                            <Button
                              variant="primary"
                              className="mr-1 p-0 border-0 shadow-none min-w-[16px] min-h-[16px] w-4 h-4 text-black"
                              iconOnly
                              colorOverride="transparent" 
                              icon={
                                <svg 
                                  className={`w-3 h-3 transition-transform duration-200 ${isPainPointsSectionExpanded ? 'rotate-90' : ''}`} 
                                  fill="none" 
                                  stroke="black" 
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                              }
                            />
                            <h4 className="text-xs font-medium text-gray-500 text-left flex items-center">
                              Assigned Pain Points 
                              {assignedPainPoints.length > 0 && (
                                <span className="ml-2 bg-gray-200 text-gray-700 text-xs px-1.5 py-0.5 rounded-full">
                                  {assignedPainPoints.length}
                                </span>
                              )}
                            </h4>
                          </div>
                          
                          {/* Pain Points Content */}
                          {isPainPointsSectionExpanded && (
                            <div className="mt-2">
                              {!hasPainPoints ? (
                                <p className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-md border border-gray-200">
                                  No pain points assigned to this process.
                                </p>
                              ) : (
                                <div className="bg-gray-50 p-3 rounded-md border border-gray-200 space-y-3">
                                  {assignedPainPoints.map((painPoint, ppIdx) => {
                                    const painPointId = `pain-point-${index}-${ppIdx}`;
                                    const isPainPointExpanded = expandedPainPoints[painPointId] || false;
                                    
                                    // Calculate the total strategic objective score
                                    const totalScore = Object.entries(painPoint)
                                      .filter(([key, value]) => key.startsWith('so_') && typeof value === 'number')
                                      .reduce((total, [_, value]) => total + (value as number), 0);
                                    
                                    return (
                                      <div 
                                        key={ppIdx} 
                                        className="bg-white rounded-md border border-gray-200 overflow-hidden"
                                      >
                                        {/* Pain Point Header */}
                                        <div 
                                          className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            togglePainPoint(painPointId);
                                          }}
                                        >
                                          <div className="flex items-center">
                                            <Button
                                              variant="primary"
                                              className="mr-1 p-0 border-0 shadow-none min-w-[16px] min-h-[16px] w-4 h-4 text-black"
                                              iconOnly
                                              colorOverride="transparent"
                                              icon={
                                                <svg 
                                                  className={`w-3 h-3 transition-transform duration-200 ${isPainPointExpanded ? 'rotate-90' : ''}`} 
                                                  fill="none" 
                                                  stroke="black" 
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                </svg>
                                              }
                                            />
                                            <h5 className="font-medium text-gray-800 text-sm">{painPoint.name}</h5>
                                          </div>
                                          
                                          <div className="flex items-center space-x-2">
                                            {/* Show total strategic objectives points */}
                                            <span className="inline-block px-2 py-0.5 rounded-md text-xs text-white font-semibold bg-[#0EA394]">
                                              {totalScore} pts
                                            </span>
                                          </div>
                                        </div>
                                        
                                        {/* Pain Point Details */}
                                        {isPainPointExpanded && (
                                          <div className="p-3 pt-0 border-t border-gray-100">
                                            <p className="text-sm text-gray-600 mb-3 pt-3 text-left">{painPoint.description}</p>
                                            
                                            {/* Strategic Objectives for this Pain Point */}
                                            <div className="mt-2">
                                              <h6 className="text-xs font-medium text-gray-500 mb-1 text-left">Strategic Objective Applicability:</h6>
                                              <div className="flex flex-wrap gap-1">
                                                {Object.entries(painPoint)
                                                  .filter(([key, value]) => key.startsWith('so_') && typeof value === 'number' && value > 0)
                                                  .map(([key, value], idx) => {
                                                    // Format the objective name
                                                    const objName = key.replace('so_', '')
                                                      .split('_')
                                                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                                      .join(' ');
                                                      
                                                    // Determine label based on score
                                                    let label = 'Low';
                                                    if (value === 2) label = 'Med';
                                                    else if (value >= 3) label = 'High';
                                                      
                                                    return (
                                                      <div 
                                                        key={idx}
                                                        className="flex items-center bg-gray-100 rounded px-2 py-1 border border-gray-200"
                                                      >
                                                        <span className="text-xs text-gray-700 text-left">{objName}</span>
                                                        <span className="ml-1.5 inline-block px-1.5 py-0.5 bg-[#0EA394] text-white text-xs rounded-full">
                                                          {label} ({value})
                                                        </span>
                                                      </div>
                                                    );
                                                  })}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Process count (if there are processes) */}
                        {group.processes && group.processes.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">
                            Contains {group.processes.length} {group.processes.length === 1 ? 'process' : 'processes'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Export with React.memo for better stability
const DetailsModal = React.memo(DetailsModalComponent);
export default DetailsModal; 