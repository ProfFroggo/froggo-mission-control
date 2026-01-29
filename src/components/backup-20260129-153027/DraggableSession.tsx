import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ReactNode } from 'react';

interface DraggableSessionProps {
  sessionKey: string;
  children: ReactNode;
  disabled?: boolean;
}

export default function DraggableSession({ sessionKey, children, disabled }: DraggableSessionProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: sessionKey,
    disabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: disabled ? 'default' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={isDragging ? 'z-50' : ''}
    >
      {children}
    </div>
  );
}
