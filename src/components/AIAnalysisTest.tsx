
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Brain, Loader2 } from 'lucide-react';

export const AIAnalysisTest: React.FC = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [itemType, setItemType] = useState<'jewelry' | 'watch' | 'gemstone'>('jewelry');
  const [title, setTitle] = useState('14k Gold Chain Necklace 18 inch 5.2 grams');
  const [description, setDescription] = useState('Beautiful 14k yellow gold chain necklace, 18 inches long, weighs 5.2 grams. Excellent condition, no damage.');
  const [price, setPrice] = useState('150');
  const [analysis, setAnalysis] = useState<any>(null);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      console.log('Running AI analysis test...');
      
      const { data, error } = await supabase.functions.invoke('ebay-item-analyzer', {
        body: {
          title,
          description,
          price: Number(price),
          currency: 'USD',
          sellerInfo: {
            feedbackScore: 1200,
            feedbackPercentage: 99.5
          },
          itemType
        }
      });

      if (error) {
        console.error('AI analysis error:', error);
        toast.error('Analysis failed: ' + error.message);
        return;
      }

      console.log('AI analysis response:', data);
      setAnalysis(data);
      toast.success('AI analysis completed successfully!');
      
    } catch (error: any) {
      console.error('Error running AI analysis:', error);
      toast.error('Error running analysis: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Analysis Test
        </CardTitle>
        <CardDescription>
          Test the AI analysis engine with sample eBay listing data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="itemType">Item Type</Label>
            <Select value={itemType} onValueChange={(value: any) => setItemType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jewelry">Jewelry</SelectItem>
                <SelectItem value="watch">Watch</SelectItem>
                <SelectItem value="gemstone">Gemstone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="price">Price ($)</Label>
            <Input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="title">Listing Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <Button 
          onClick={runAnalysis} 
          disabled={isAnalyzing}
          className="w-full"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing with AI...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4 mr-2" />
              Run AI Analysis
            </>
          )}
        </Button>

        {analysis && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <strong>Quality Score:</strong> {analysis.qualityScore}/100
                </div>
                <div>
                  <strong>Deal Score:</strong> {analysis.dealScore}/100
                </div>
              </div>

              {analysis.extractedData && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Extracted Data:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {analysis.extractedData.weight_g && (
                      <div>Weight: {analysis.extractedData.weight_g}g</div>
                    )}
                    {analysis.extractedData.metal_type && (
                      <div>Metal: {analysis.extractedData.metal_type}</div>
                    )}
                    {analysis.extractedData.melt_value && (
                      <div>Melt Value: ${analysis.extractedData.melt_value.toFixed(2)}</div>
                    )}
                    {analysis.extractedData.profit_scrap && (
                      <div>Scrap Profit: ${analysis.extractedData.profit_scrap.toFixed(2)}</div>
                    )}
                  </div>
                </div>
              )}

              {analysis.riskFlags && analysis.riskFlags.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Risk Flags:</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysis.riskFlags.map((flag: string, index: number) => (
                      <span key={index} className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.reasoning && (
                <div>
                  <h4 className="font-semibold mb-2">AI Reasoning:</h4>
                  <p className="text-sm text-gray-600">{analysis.reasoning}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};
