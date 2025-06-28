import React, { createContext, useState, useEffect } from 'react';
import { fetchTags } from '../services/api';

const TagsContext = createContext();

export { TagsContext };

export const TagsProvider = ({ children }) => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTags = async () => {
    try {
      setLoading(true);
      const tagsData = await fetchTags();
      setTags(tagsData);
    } catch (error) {
      console.error('Error cargando etiquetas:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTags = (newTags) => {
    setTags(newTags);
  };

  const addTag = (newTag) => {
    setTags(prev => [...prev, newTag]);
  };

  const updateTag = (updatedTag) => {
    setTags(prev => prev.map(tag => 
      tag.id === updatedTag.id ? updatedTag : tag
    ));
  };

  const removeTag = (tagId) => {
    setTags(prev => prev.filter(tag => tag.id !== tagId));
  };

  useEffect(() => {
    loadTags();
  }, []);

  const value = {
    tags,
    loading,
    loadTags,
    updateTags,
    addTag,
    updateTag,
    removeTag
  };

  return (
    <TagsContext.Provider value={value}>
      {children}
    </TagsContext.Provider>
  );
}; 