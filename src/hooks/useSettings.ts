
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface PreciousMetalApiSettings {
  provider: string;
  api_key: string;
  poll_interval: number;
}

interface EbayKeysSettings {
  keys: Array<{
    label: string;
    key: string;
    request_interval: number;
  }>;
  rotation_strategy: string;
}

interface LlmConfigSettings {
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
  api_key?: string;
  endpoint_url?: string;
}

interface TaskTemplatesSettings {
  enabled: boolean;
  templates: string[];
}

interface Settings {
  precious_metal_api?: PreciousMetalApiSettings;
  ebay_keys?: EbayKeysSettings;
  llm_config?: LlmConfigSettings;
  task_templates?: TaskTemplatesSettings;
}

export const useSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*');

      if (error) {
        console.error('Error fetching settings:', error);
        return;
      }

      const settingsObj: Settings = {};
      data?.forEach(item => {
        // Type assertion to handle the Json type from Supabase
        settingsObj[item.key as keyof Settings] = item.value_json as any;
      });

      setSettings(settingsObj);
    } catch (error) {
      console.error('Error in fetchSettings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof Settings, value: any) => {
    if (!user) return;

    const { error } = await supabase
      .from('settings')
      .upsert({
        key,
        value_json: value,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error updating setting:', error);
      throw error;
    }

    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return {
    settings,
    loading,
    updateSetting,
    refetch: fetchSettings,
  };
};
