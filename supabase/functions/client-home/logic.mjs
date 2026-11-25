function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function newestFirst(items) {
  return [...items].sort((first, second) => timestamp(second.createdAt) - timestamp(first.createdAt));
}

function conversationPeer(conversation, userId) {
  if (conversation.participant_a_id === userId) {
    return {id: conversation.participant_b_id, role: conversation.participant_b_role};
  }
  if (conversation.participant_b_id === userId) {
    return {id: conversation.participant_a_id, role: conversation.participant_a_role};
  }
  return {id: null, role: null};
}

function conversationRole(conversation, userId) {
  if (conversation.participant_a_id === userId) return conversation.participant_a_role;
  if (conversation.participant_b_id === userId) return conversation.participant_b_role;
  return null;
}

function flattenMessages(conversation) {
  const sources = Array.isArray(conversation.sources) ? conversation.sources : [conversation];
  const messages = sources.flatMap(source => (Array.isArray(source.messages) ? source.messages : [])
    .map(message => ({
      ...message,
      explicit_project_id: message.project_id || null,
      source_project_id: source.project_id || null,
      source_conversation_id: source.id || conversation.id
    })))
    .sort((first, second) => timestamp(first.created_at) - timestamp(second.created_at)
      || String(first.id || '').localeCompare(String(second.id || '')));
  let contextProjectId = conversation.project_id || null;
  return messages.map(message => {
    if (message.explicit_project_id) {
      contextProjectId = message.explicit_project_id;
    } else if (message.source_conversation_id !== conversation.id && message.source_project_id) {
      contextProjectId = message.source_project_id;
    }
    return {...message, project_id: message.explicit_project_id || message.source_project_id || contextProjectId};
  });
}

function unreadInquiryRuns(conversation, messages, userId, projectsById, developerIds) {
  const peer = conversationPeer(conversation, userId);
  if (!peer.id || !developerIds.has(peer.id)) return [];

  const runsByRequest = new Map();
  messages.forEach(message => {
    const project = projectsById.get(message.project_id);
    if (project?.project_kind !== 'request' || project.owner_id !== userId) return;
    const runs = runsByRequest.get(project.id) || [];
    if (message.sender_id === peer.id) {
      let run = runs[runs.length - 1];
      if (!run || run.ended) {
        run = {latestUnreadMessage: null, ended: false};
        runs.push(run);
      }
      if (!message.read_at) run.latestUnreadMessage = message;
      runsByRequest.set(project.id, runs);
    } else if (message.sender_id === userId && runs.length) {
      runs[runs.length - 1].ended = true;
    }
  });

  return [...runsByRequest.entries()].flatMap(([projectId, runs]) => runs.flatMap(run => {
    return run.latestUnreadMessage
      ? [{message: run.latestUnreadMessage, project: projectsById.get(projectId)}]
      : [];
  }));
}

export function buildClientDashboard({
  userId,
  requests,
  conversations,
  engagements,
  projects,
  developers,
  profileComplete = false,
  hasExploredProjects = false
}) {
  const projectsById = new Map(projects.map(project => [project.id, project]));
  const developersById = new Map(developers.map(developer => [developer.id, developer.name]));
  const developerIds = new Set(developersById.keys());
  const threads = conversations
    .filter(conversation => !conversation.merged_into && conversationRole(conversation, userId) === 'client')
    .map(conversation => ({conversation, messages: flattenMessages(conversation)}))
    .filter(thread => thread.messages.length > 0);
  const latestMessages = threads.map(thread => ({
    ...thread,
    message: thread.messages[thread.messages.length - 1]
  }));
  const inquiryCounts = new Map();

  threads.forEach(({conversation, messages}) => {
    const peer = conversationPeer(conversation, userId);
    if (!peer.id || !developerIds.has(peer.id)) return;
    messages.forEach(message => {
      const project = projectsById.get(message.project_id);
      if (message.sender_id !== peer.id
        || project?.project_kind !== 'request'
        || project.owner_id !== userId) return;
      const developersForRequest = inquiryCounts.get(project.id) || new Set();
      developersForRequest.add(peer.id);
      inquiryCounts.set(project.id, developersForRequest);
    });
  });

  const inquiryItems = threads.flatMap(({conversation, messages}) =>
    unreadInquiryRuns(conversation, messages, userId, projectsById, developerIds)
      .map(({message, project}) => ({conversation, message, project}))
  );
  const awaitingReply = latestMessages.filter(({conversation, message}) =>
    developerIds.has(conversationPeer(conversation, userId).id)
      && message.sender_id === userId
  );
  const attention = [];
  const postedRequests = newestFirst(requests
    .filter(request => request.status === 'open' || request.status === 'closed')
    .map(request => {
      const data = request.data && typeof request.data === 'object' && !Array.isArray(request.data)
        ? request.data
        : {};
      return {
        id: request.id,
        title: request.title || 'Untitled request',
        status: request.status,
        price: request.price || data.budget || data.budgetLabel || '',
        budgetFrom: data.budgetFrom || '',
        budgetTo: data.budgetTo || '',
        inquiries: inquiryCounts.get(request.id)?.size || 0,
        createdAt: request.created_at || request.updated_at || ''
      };
    }))
    .slice(0, 5);

  const sentConversations = newestFirst(threads.flatMap(({conversation, messages}) => {
    const peer = conversationPeer(conversation, userId);
    if (!developerIds.has(peer.id)) return [];
    const sentProjectIds = new Set();
    const latestMessageByProject = new Map();
    messages.forEach(message => {
      const project = projectsById.get(message.project_id);
      if (project?.owner_id !== peer.id || project.project_kind !== 'portfolio') return;
      latestMessageByProject.set(project.id, message);
      if (message.sender_id === userId) sentProjectIds.add(project.id);
    });
    return [...sentProjectIds].map(projectId => {
      const project = projectsById.get(projectId);
      const latestMessage = latestMessageByProject.get(projectId);
      return {
        conversationId: conversation.id,
        projectId,
        project: project.title || 'Developer project',
        developer: developersById.get(peer.id) || 'Developer',
        status: latestMessage.sender_id === userId ? 'awaiting-reply' : 'replied',
        createdAt: latestMessage.created_at
      };
    });
  })).slice(0, 5);
  const hasPostedRequest = requests.some(request => request.status === 'open' || request.status === 'closed');

  inquiryItems.forEach(({conversation, message, project}) => {
    const peer = conversationPeer(conversation, userId);
    attention.push({
      type: 'inquiry',
      developer: developersById.get(peer.id) || 'Developer',
      context: project?.title || 'your request',
      createdAt: message.created_at,
      conversationId: conversation.id
    });
  });

  awaitingReply.forEach(({conversation, message}) => {
    const peer = conversationPeer(conversation, userId);
    const project = projectsById.get(message.project_id);
    attention.push({
      type: 'awaiting-reply',
      developer: developersById.get(peer.id) || 'Developer',
      context: project?.title || 'your conversation',
      createdAt: message.created_at,
      conversationId: conversation.id
    });
  });

  engagements.forEach(engagement => {
    const hasClientReview = (engagement.project_reviews || [])
      .some(review => review.reviewer_id === userId);
    if (!engagement.client_completed_at || !engagement.developer_completed_at || hasClientReview) return;
    const completedAt = timestamp(engagement.client_completed_at) > timestamp(engagement.developer_completed_at)
      ? engagement.client_completed_at
      : engagement.developer_completed_at;
    attention.push({
      type: 'rate',
      developer: developersById.get(engagement.developer_id) || 'Developer',
      context: projectsById.get(engagement.project_id)?.title || 'your project',
      createdAt: completedAt,
      conversationId: engagement.conversation_id
    });
  });

  const orderedAttention = newestFirst(attention);
  return {
    metrics: {
      openRequests: requests.filter(request => request.status === 'open').length,
      newInquiries: inquiryItems.length,
      awaitingDeveloperReply: awaitingReply.length
    },
    gettingStarted: {
      profileComplete,
      exploredProjects: hasExploredProjects,
      postedRequest: hasPostedRequest
    },
    postedRequests,
    sentConversations,
    attention: orderedAttention.slice(0, 5)
  };
}
