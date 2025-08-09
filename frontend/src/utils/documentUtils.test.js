/* eslint-env jest */
import { describe, it, expect } from 'vitest';
import { documentTypeAbbreviations, getDocumentAbbreviation } from './documentUtils';

describe('documentUtils', () => {
  describe('documentTypeAbbreviations', () => {
    it('should have correct abbreviations for all document types', () => {
      expect(documentTypeAbbreviations.DNI).toBe('DNI');
      expect(documentTypeAbbreviations['CÉDULA DE IDENTIDAD']).toBe('CI');
      expect(documentTypeAbbreviations.CUIT).toBe('CUIT');
      expect(documentTypeAbbreviations['LIBRETA CÍVICA']).toBe('LC');
      expect(documentTypeAbbreviations['LIBRETA DE ENROLAMENTO']).toBe('LE');
      expect(documentTypeAbbreviations['LIBRETA DE EMBARQUE']).toBe('LEM');
      expect(documentTypeAbbreviations.PASAPORTE).toBe('PAS');
      expect(documentTypeAbbreviations.OTRO).toBe('OTRO');
    });

    it('should contain all expected document types', () => {
      const expectedTypes = [
        'DNI', 'CÉDULA DE IDENTIDAD', 'CUIT', 'LIBRETA CÍVICA',
        'LIBRETA DE ENROLAMENTO', 'LIBRETA DE EMBARQUE', 'PASAPORTE', 'OTRO'
      ];

      expectedTypes.forEach(type => {
        expect(documentTypeAbbreviations).toHaveProperty(type);
      });
    });
  });

  describe('getDocumentAbbreviation', () => {
    it('should return correct abbreviation for known document types', () => {
      expect(getDocumentAbbreviation('DNI')).toBe('DNI');
      expect(getDocumentAbbreviation('CÉDULA DE IDENTIDAD')).toBe('CI');
      expect(getDocumentAbbreviation('CUIT')).toBe('CUIT');
      expect(getDocumentAbbreviation('LIBRETA CÍVICA')).toBe('LC');
      expect(getDocumentAbbreviation('LIBRETA DE ENROLAMENTO')).toBe('LE');
      expect(getDocumentAbbreviation('LIBRETA DE EMBARQUE')).toBe('LEM');
      expect(getDocumentAbbreviation('PASAPORTE')).toBe('PAS');
      expect(getDocumentAbbreviation('OTRO')).toBe('OTRO');
    });

    it('should return original value for unknown document types', () => {
      expect(getDocumentAbbreviation('UNKNOWN_TYPE')).toBe('UNKNOWN_TYPE');
      expect(getDocumentAbbreviation('CUSTOM_DOC')).toBe('CUSTOM_DOC');
      expect(getDocumentAbbreviation('')).toBe('');
    });

    it('should handle edge cases gracefully', () => {
      expect(getDocumentAbbreviation(null)).toBe(null);
      expect(getDocumentAbbreviation(undefined)).toBe(undefined);
      expect(getDocumentAbbreviation(123)).toBe(123);
      expect(getDocumentAbbreviation('')).toBe('');
    });

    it('should be case sensitive', () => {
      expect(getDocumentAbbreviation('dni')).toBe('dni');
      expect(getDocumentAbbreviation('Dni')).toBe('Dni');
      expect(getDocumentAbbreviation('DNI')).toBe('DNI');
    });

    it('should handle special characters correctly', () => {
      expect(getDocumentAbbreviation('CÉDULA DE IDENTIDAD')).toBe('CI');
      expect(getDocumentAbbreviation('LIBRETA CÍVICA')).toBe('LC');
    });
  });

  describe('integration tests', () => {
    it('should handle all document types consistently', () => {
      const documentTypes = [
        'DNI', 'CÉDULA DE IDENTIDAD', 'CUIT', 'LIBRETA CÍVICA',
        'LIBRETA DE ENROLAMENTO', 'LIBRETA DE EMBARQUE', 'PASAPORTE', 'OTRO'
      ];

      documentTypes.forEach(docType => {
        const abbreviation = getDocumentAbbreviation(docType);
        expect(typeof abbreviation).toBe('string');
        expect(abbreviation.length).toBeGreaterThan(0);
        expect(documentTypeAbbreviations[docType]).toBe(abbreviation);
      });
    });

    it('should maintain consistency between object and function', () => {
      Object.entries(documentTypeAbbreviations).forEach(([docType, abbreviation]) => {
        expect(getDocumentAbbreviation(docType)).toBe(abbreviation);
      });
    });
  });
}); 