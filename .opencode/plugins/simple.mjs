export const SimplePlugin = async ({
  project,
  client,
  $,
  directory,
  worktree,
}) => {
  console.error("=== SIMPLE PLUGIN LOADED ===");
  console.error("Project:", project?.name);
  console.error("Directory:", directory);

  return {
    event: async ({ event }) => {
      console.error("=== EVENT RECEIVED ===");
      console.error("Type:", event?.type);
    },
  };
};

export default SimplePlugin;
