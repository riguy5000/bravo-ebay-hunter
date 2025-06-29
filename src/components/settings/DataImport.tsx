
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Upload, FileText, Database } from 'lucide-react';

export const DataImport = () => {
  const [importing, setImporting] = useState(false);

  const handleFileImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setImporting(true);

    // Simulate import process
    setTimeout(() => {
      toast.success('Data import completed successfully!');
      setImporting(false);
    }, 2000);
  };

  const handleBulkImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setImporting(true);

    // Simulate bulk import process
    setTimeout(() => {
      toast.success('Bulk data import completed successfully!');
      setImporting(false);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            CSV Import
          </CardTitle>
          <CardDescription>
            Import your existing data from CSV files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFileImport} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv_file">Select CSV File</Label>
              <Input
                id="csv_file"
                type="file"
                accept=".csv"
                disabled={importing}
              />
              <p className="text-sm text-gray-500">
                Supported formats: Tasks, Purchases, Sales data
              </p>
            </div>

            <Button type="submit" disabled={importing}>
              {importing ? 'Importing...' : 'Import CSV'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bulk Data Import
          </CardTitle>
          <CardDescription>
            Import multiple records using JSON format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBulkImport} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk_data">JSON Data</Label>
              <Textarea
                id="bulk_data"
                placeholder='{"tasks": [...], "purchases": [...], "sales": [...]}'
                rows={8}
                disabled={importing}
              />
              <p className="text-sm text-gray-500">
                Paste your JSON data here. See documentation for format examples.
              </p>
            </div>

            <Button type="submit" disabled={importing}>
              {importing ? 'Processing...' : 'Import Data'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Import Templates
          </CardTitle>
          <CardDescription>
            Download templates to format your data correctly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Tasks Template
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Purchases Template
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Sales Template
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
