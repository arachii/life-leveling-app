export function spentEnergy(tasks) {
  return (tasks || [])
    .filter((task) => task.done)
    .reduce((sum, task) => sum + Number(task.energyCost || 0), 0);
}

export function remainingEnergy(state) {
  return Math.max(0, Number(state.profile.energy || 0) - spentEnergy(state.today.tasks));
}
