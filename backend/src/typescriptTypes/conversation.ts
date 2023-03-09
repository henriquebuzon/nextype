import { Prisma } from "@prisma/client";
import { participantsAndLatestMessage } from "../graphql/resolvers/conversation";

/* The data that is returned from createConversationMutation. */
export interface CreateConversationData {
  createConversation: {
    newConversationId: string;
  };
}

/* The data that we pass to the createConversationMutation
  as argument */
export interface CreateConversationInput {
  participantsIds: Array<string>;
}

/* Structure of the conversations that are populated with the 
  reusable prisma query (generated by prisma) named as 
  "participantsAndLatestMessage" */
export type ConversationPopulated = Prisma.ConversationGetPayload<{
  include: typeof participantsAndLatestMessage;
}>;
