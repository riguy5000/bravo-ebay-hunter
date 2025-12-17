-- Fix RLS policies on tasks table to allow all authenticated users to view all tasks
-- This enables shared task visibility across team members

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;

-- Create a new policy that allows all authenticated users to view all tasks
CREATE POLICY "All users can view tasks" ON public.tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Also update the update/delete policies to allow team members to manage shared tasks
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
CREATE POLICY "All users can update tasks" ON public.tasks
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;
CREATE POLICY "All users can delete tasks" ON public.tasks
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Keep the insert policy - users still create tasks under their own user_id
-- DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
-- The existing insert policy is fine
