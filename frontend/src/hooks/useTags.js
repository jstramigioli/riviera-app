import { useContext } from 'react';
import { TagsContext } from '../contexts/TagsContext';

export const useTags = () => {
  const context = useContext(TagsContext);
  if (!context) {
    throw new Error('useTags debe ser usado dentro de un TagsProvider');
  }
  return context;
}; 