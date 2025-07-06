
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useUserSettings } from '@/hooks/useUserSettings';

export const GeneralSettings = () => {
  const { settings, loading, updateSettings } = useUserSettings();
  const [saving, setSaving] = useState(false);

  if (loading) {
    return <div>Loading general settings...</div>;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const updates = {
      theme: formData.get('theme') as string,
      email_notifications: formData.get('email_notifications') === 'on',
      match_notifications: formData.get('match_notifications') === 'on',
    };

    try {
      await updateSettings(updates);
      toast.success('General settings updated successfully!');
    } catch (error) {
      toast.error('Failed to update general settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General Preferences</CardTitle>
          <CardDescription>
            Configure your personal preferences and notification settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="theme">Theme</Label>
                <Select name="theme" defaultValue={settings?.theme || 'light'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Notification Preferences</h4>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email_notifications">Email Notifications</Label>
                  <p className="text-sm text-gray-500">Receive email alerts for important events</p>
                </div>
                <Switch
                  name="email_notifications"
                  defaultChecked={settings?.email_notifications ?? true}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="match_notifications">Match Notifications</Label>
                  <p className="text-sm text-gray-500">Get notified when new matches are found</p>
                </div>
                <Switch
                  name="match_notifications"
                  defaultChecked={settings?.match_notifications ?? true}
                />
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Account Created:</span>
              <span>{settings?.created_at ? new Date(settings.created_at).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Updated:</span>
              <span>{settings?.updated_at ? new Date(settings.updated_at).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
