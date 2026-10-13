/* Breath keeps its takes in one table and one bucket. The database on the site fills in the owner of a take;
   here the owner is the one person on this device. */
LocalSupabase.configure({
  name: 'breath',
  you: { display_name: 'You' },
  defaults: { breath_takes: { owner: '$uid' } }
});
