
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UserSettings {
  id?: string;
  user_id?: string;
  ebay_api_version: string;
  gold_api_version: string;
  openai_model: string;
  default_poll_interval: number;
  default_max_price: number;
  email_notifications: boolean;
  match_notifications: boolean;
  theme: string;
}

export const useUserSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserSettings();
    }
  }, [user]);

  const fetchUserSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user settings:', error);
        return;
      }

      if (data) {
        setSettings(data);
      } else {
        // Create default settings if none exist
        await createDefaultSettings();
      }
    } catch (error) {
      console.error('Error in fetchUserSettings:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    if (!user) return;

    const defaultSettings = {
      user_id: user.id,
      ebay_api_version: 'v1',
      gold_api_version: 'v1',
      openai_model: 'gpt-4',
      default_poll_interval: 300,
      default_max_price: 1000,
      email_notifications: true,
      match_notifications: true,
      theme: 'light',
    };

    const { data, error } = await supabase
      .from('user_settings')
      .insert(defaultSettings)
      .select()
      .single();

    if (error) {
      console.error('Error creating default settings:', error);
    } else {
      setSettings(data);
    }
  };

  const updateSettings = async (updatedSettings: Partial<UserSettings>) => {
    if (!user || !settings) return;

    const { data, error } = await supabase
      .from('user_settings')
      .update(updatedSettings)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating settings:', error);
      throw error;
    }

    setSettings(data);
    return data;
  };

  return {
    settings,
    loading,
    updateSettings,
    refetch: fetchUserSettings,
  };
};
