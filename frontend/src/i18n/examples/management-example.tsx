/**
 * Translation Management Examples
 * Shows how to use the translation management utilities in your application
 */

import React, { useEffect, useState } from 'react';
import management from '../management';

// Example: Translation Coverage Dashboard
export function TranslationCoverageDashboard() {
  const [coverage, setCoverage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCoverage() {
      try {
        const data = await management.calculateCoverage();
        setCoverage(data);
      } catch (error) {
        console.error('Failed to load coverage:', error);
      } finally {
        setLoading(false);
      }
    }
    loadCoverage();
  }, []);

  if (loading) return <div>Loading coverage data...</div>;
  if (!coverage) return <div>No coverage data available</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Translation Coverage</h2>
      
      {Object.entries(coverage).map(([locale, namespaces]: [string, any]) => (
        <div key={locale} className="mb-6">
          <h3 className="text-xl font-semibold mb-2">{locale.toUpperCase()}</h3>
          
          <div className="space-y-2">
            {Object.entries(namespaces).map(([namespace, stats]: [string, any]) => (
              <div key={namespace} className="flex items-center space-x-4">
                <span className="w-32">{namespace}:</span>
                <div className="flex-1 bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-green-500 h-4 rounded-full"
                    style={{ width: `${stats.coverage}%` }}
                  />
                </div>
                <span className="text-sm">
                  {stats.coverage.toFixed(1)}% ({stats.translatedKeys}/{stats.totalKeys})
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Example: Missing Translations List
export function MissingTranslationsList() {
  const [missing, setMissing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMissing() {
      try {
        const data = await management.findMissingTranslations();
        setMissing(data);
      } catch (error) {
        console.error('Failed to load missing translations:', error);
      } finally {
        setLoading(false);
      }
    }
    loadMissing();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">
        Missing Translations ({missing.length})
      </h2>
      
      {missing.length === 0 ? (
        <p className="text-green-600">All translations are complete!</p>
      ) : (
        <div className="space-y-2">
          {missing.slice(0, 20).map((item, index) => (
            <div key={index} className="p-2 bg-gray-100 rounded">
              <div className="font-mono text-sm">
                {item.locale}: {item.namespace}.{item.key}
              </div>
              {item.referenceValue && (
                <div className="text-gray-600 text-sm mt-1">
                  Reference: "{item.referenceValue}"
                </div>
              )}
            </div>
          ))}
          {missing.length > 20 && (
            <p className="text-gray-600">... and {missing.length - 20} more</p>
          )}
        </div>
      )}
    </div>
  );
}

// Example: Export Translations Button
export function ExportTranslationsButton({ locale }: { locale: string }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await management.exportForTranslators(locale, 'json');
      alert(`Translations exported for ${locale}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
    >
      {exporting ? 'Exporting...' : `Export ${locale.toUpperCase()} Translations`}
    </button>
  );
}

// Example: Dev Tools Panel
export function TranslationDevTools() {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-2 bg-blue-500 text-white rounded-full"
      >
        🌍
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white shadow-lg rounded-lg p-4 max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold">Translation Dev Tools</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-4">
        <div className="space-x-2">
          <ExportTranslationsButton locale="cs" />
          <ExportTranslationsButton locale="ar" />
        </div>
        
        <details className="border-t pt-4">
          <summary className="cursor-pointer font-semibold">Coverage</summary>
          <TranslationCoverageDashboard />
        </details>
        
        <details className="border-t pt-4">
          <summary className="cursor-pointer font-semibold">Missing</summary>
          <MissingTranslationsList />
        </details>
      </div>
    </div>
  );
}

// Example: Usage in development
export function DevelopmentApp() {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div>
      {/* Your app content */}
      
      {/* Show dev tools only in development */}
      {isDevelopment && <TranslationDevTools />}
    </div>
  );
}