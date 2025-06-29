
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useUserSettings } from '@/hooks/useUserSettings';

export const UserPreferences = () => {
  const { settings, loading, updateSettings } = useUserSettings();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const updates = {
      email_notifications: formData.get('email_notifications') === 'on',
      match_notifications: formData.get('match_notifications') === 'on',
      theme: formData.get('theme') as string,
    };

    try {
      await updateSettings(updates);
      toast.success('Preferences updated successfully!');
    } catch (error) {
      toast.error('Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Loading preferences...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Preferences</CardTitle>
        <CardDescription>Customize your CRM experience</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h4 className="font-medium">Notifications</h4>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email_notifications">Email Notifications</Label>
                <p className="text-sm text-gray-500">
                  Receive email notifications for important updates
                </p>
              </div>
              <Switch
                id="email_notifications"
                name="email_notifications"
                defaultChecked={settings?.email_notifications || true}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="match_notifications">Match Notifications</Label>
                <p className="text-sm text-gray-500">
                  Get notified when new matches are found
                </p>
              </div>
              <Switch
                id="match_notifications"
                name="match_notifications"
                defaultChecked={settings?.match_notifications || true}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium">Appearance</h4>
            
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select name="theme" defaultValue={settings?.theme || 'light'}>
                <SelectTrigger className="w-full">
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

          <div className="pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
