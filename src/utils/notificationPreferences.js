export const DEFAULT_NOTIFICATION_PREFERENCES = {
  choreAssigned: true,
  choreCompleted: true,
  choreApproval: true,
  missedChores: true,
  rewardRequest: true,
  rewardUpdates: true,
  privilegeExpired: true,
  patOnBack: true,
  unfinishedChores: true,
};

export function notificationOptionsForRole(role) {
  if (role === 'parent') {
    return [
      {key: 'choreAssigned', title: 'Chore assignments', description: 'When a new chore is assigned to you.'},
      {key: 'choreCompleted', title: 'Completed chores', description: 'When another family member completes a chore.'},
      {key: 'choreApproval', title: 'Chores needing approval', description: 'When a family member submits a chore for review.'},
      {key: 'missedChores', title: 'Missed chores', description: 'When chores pass their due date and need review.'},
      {key: 'rewardRequest', title: 'When someone redeems a reward', description: 'When another family member redeems a reward.'},
      {key: 'unfinishedChores', title: 'Unfinished chores', description: 'An evening reminder when today’s chores are still unfinished.'},
      {key: 'patOnBack', title: 'Encouragement', description: 'When another family member sends you a thumbs-up.'},
    ];
  }

  return [
    {key: 'choreAssigned', title: 'Chore assignments', description: 'When a new chore is assigned to you.'},
    {key: 'rewardUpdates', title: 'Reward updates', description: 'When a reward request is approved or rejected.'},
    {key: 'privilegeExpired', title: 'Privilege expiration', description: 'When one of your active privileges expires.'},
    {key: 'patOnBack', title: 'Encouragement', description: 'When another family member sends you a thumbs-up.'},
    {key: 'unfinishedChores', title: 'Unfinished chores', description: 'An evening reminder when today’s chores are still unfinished.'},
  ];
}
