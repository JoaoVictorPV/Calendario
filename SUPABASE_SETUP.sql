-- Create Tags Table
create table tags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  color text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Events Table
create table events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  date text not null, -- Storing as YYYY-MM-DD string is often simpler for calendars
  tag_id uuid references tags(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table tags enable row level security;
alter table events enable row level security;

-- Policies
create policy "Users can view their own tags" on tags
  for select using (auth.uid() = user_id);

create policy "Users can insert their own tags" on tags
  for insert with check (auth.uid() = user_id);

create policy "Users can view their own events" on events
  for select using (auth.uid() = user_id);

create policy "Users can insert their own events" on events
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own events" on events
  for update using (auth.uid() = user_id);

create policy "Users can delete their own events" on events
  for delete using (auth.uid() = user_id);
