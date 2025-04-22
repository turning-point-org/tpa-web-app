declare module 'react-beautiful-dnd' {
  import * as React from 'react';

  export type DroppableId = string;
  export type DraggableId = string;
  export type TypeId = string;
  export type MovementMode = 'FLUID' | 'SNAP';
  export type DropReason = 'DROP' | 'CANCEL';

  export interface DraggableLocation {
    droppableId: DroppableId;
    index: number;
  }

  export interface DragStart {
    draggableId: DraggableId;
    type: TypeId;
    source: DraggableLocation;
    mode: MovementMode;
  }

  export interface DropResult {
    draggableId: DraggableId;
    type: TypeId;
    source: DraggableLocation;
    destination: DraggableLocation | null;
    reason: DropReason;
    mode: MovementMode;
    combine: any | null;
  }

  export interface DroppableProps {
    droppableId: DroppableId;
    type?: TypeId;
    isDropDisabled?: boolean;
    isCombineEnabled?: boolean;
    direction?: 'horizontal' | 'vertical';
    ignoreContainerClipping?: boolean;
    renderClone?: any;
    getContainerForClone?: any;
    children: (provided: DroppableProvided, snapshot: DroppableStateSnapshot) => React.ReactElement<any>;
  }

  export interface DroppableProvided {
    innerRef: React.RefCallback<HTMLElement>;
    droppableProps: {
      [key: string]: any;
    };
    placeholder?: React.ReactElement<any> | null;
  }

  export interface DroppableStateSnapshot {
    isDraggingOver: boolean;
    draggingOverWith?: DraggableId;
    draggingFromThisWith?: DraggableId;
    isUsingPlaceholder: boolean;
  }

  export interface DraggableProps {
    draggableId: DraggableId;
    index: number;
    isDragDisabled?: boolean;
    disableInteractiveElementBlocking?: boolean;
    shouldRespectForcePress?: boolean;
    children: (provided: DraggableProvided, snapshot: DraggableStateSnapshot, rubric: DraggableRubric) => React.ReactElement<any>;
    style?: React.CSSProperties;
  }

  export interface DraggableProvided {
    draggableProps: {
      [key: string]: any;
    };
    dragHandleProps: {
      [key: string]: any;
    } | null;
    innerRef: React.RefCallback<HTMLElement>;
  }

  export interface DraggableStateSnapshot {
    isDragging: boolean;
    isDropAnimating: boolean;
    dropAnimation?: {
      [key: string]: any;
    };
    draggingOver?: DroppableId;
    combineWith?: DraggableId;
    combineTargetFor?: DraggableId;
    mode?: MovementMode;
  }

  export interface DraggableRubric {
    draggableId: DraggableId;
    type: TypeId;
    source: DraggableLocation;
  }

  export interface DragDropContextProps {
    onDragStart?: (start: DragStart) => void;
    onDragUpdate?: (update: any) => void;
    onDragEnd: (result: DropResult) => void;
    children: React.ReactNode;
    sensors?: any[];
    enableDefaultSensors?: boolean;
    nonce?: string;
  }

  export class Droppable extends React.Component<DroppableProps> {}
  export class Draggable extends React.Component<DraggableProps> {}
  export class DragDropContext extends React.Component<DragDropContextProps> {}
  export function resetServerContext(): void;
} 