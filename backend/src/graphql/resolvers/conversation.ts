import { Prisma } from "@prisma/client";
import { GraphQLError } from "graphql";
import { withFilter } from "graphql-subscriptions";
import {
  ConversationCreationSubscriptionPayload,
  PopulatedConversation,
} from "../../typescriptTypes/conversation";
import { GraphQLContext } from "../../typescriptTypes/server";

export default {
  Query: {
    getAllConversations: async (
      _: any,
      __: any,

      /* Extracting current session data and prisma client from
      Apollo Server context */
      { currentSession, prisma }: GraphQLContext
    ): Promise<Array<PopulatedConversation>> => {
      if (!currentSession?.user.id) throw new GraphQLError("Not logged in");

      try {
        /* Fetch all conversations from currently authenticated user */
        const allConversations = await prisma.conversation.findMany({
          where: {
            participants: {
              some: {
                userId: {
                  equals: currentSession.user.id,
                },
              },
            },
          },

          /* Populating the fields "participants" and "latestMessage" */
          include: populatedConversation,
        });

        /* Send array of populated conversations to the client */
        return allConversations;
      } catch (error) {
        console.log(error);
        throw new GraphQLError("Error fetching conversations");
      }
    },
    getConversationById: async (
      _: any,

      /* Extracting selected conversation id from input */
      {
        selectedConversationId = undefined,
      }: { selectedConversationId: string | undefined },

      /* Extracting prisma and session from Apollo context */
      { currentSession, prisma }: GraphQLContext
    ): Promise<PopulatedConversation | null> => {
      if (!currentSession?.user.id) throw new GraphQLError("Not logged in");
      if (!selectedConversationId) {
        return null;
      }

      try {
        /* Fetch conversation by ID and populate the fields "participants" and "latestMessage" */
        const conversationFound = await prisma.conversation.findUnique({
          where: {
            id: selectedConversationId,
          },
          include: populatedConversation,
        });

        if (!conversationFound)
          throw new GraphQLError("Conversation not found");

        /* Making sure the current user is a participant of the conversation */
        const isParticipant = conversationFound.participants.some(
          (p) => p.userId === currentSession.user.id
        );
        if (!isParticipant) throw new GraphQLError("Access denied");

        /* Send populated conversation to the client */
        return conversationFound;
      } catch (error) {
        console.log(error);
        throw new GraphQLError("Error fetching conversation");
      }
    },
  },

  Mutation: {
    createConversation: async (
      _: any,

      /* Extracting array of participants ids from input */
      { participantsIds }: { participantsIds: string[] },

      /* Extracting current session data, prisma client and
       pubsub client from Apollo context */
      { currentSession, prisma, pubsub }: GraphQLContext
    ): Promise<{ newConversationId: string }> => {
      if (!currentSession?.user.id) throw new GraphQLError("Not logged in");
      /* Insert currently authenticated user into the conversation he is creating */
      participantsIds.push(currentSession?.user.id);

      try {
        /* Creating one "Conversation" document for this new conversation */
        const newConversation = await prisma.conversation.create({
          data: {
            /* Creating one "ConversationParticipant" document for each one
             of the participants in this new conversation */
            participants: {
              createMany: {
                data: participantsIds.map((id) => ({
                  userId: id,
                  hasSeenLatestMessage: id === currentSession.user.id,
                })),
              },
            },
          },

          /* This "include" specifies the fields that shall be populated on this 
          "newConversation" object that is returned from the 
          prisma.conversation.create() */
          include: populatedConversation,
        });

        /* Update conversation lists of the participants in
         real-time */
        pubsub.publish("CONVERSATION_CREATION", {
          conversationCreation: newConversation,
        });

        /* Send new conversation id to the client */
        return { newConversationId: newConversation.id };
      } catch (error) {
        console.log(error);
        throw new GraphQLError("Error creating conversation");
      }
    },
  },

  Subscription: {
    conversationCreation: {
      /* This subscription is triggered every time there is an
         event on the "CONVERSATION_CREATION" channel */
      subscribe: withFilter(
        (_: any, __: any, { pubsub }: GraphQLContext) => {
          return pubsub.asyncIterator(["CONVERSATION_CREATION"]);
        },

        (
          {
            conversationCreation: { participants },
          }: ConversationCreationSubscriptionPayload,
          _,
          { currentSession }: GraphQLContext
        ) => {
          if (!currentSession?.user) {
            throw new GraphQLError("Not authorized");
          }

          const currentUserIsParticipant = !!participants.find(
            (participant) => participant.userId === currentSession.user.id
          );

          return currentUserIsParticipant;
        }
      ),
    },
  },
};

/* Reusable piece of query that populates the fields "participants"
 and "latestMessage" in the queried conversation */
export const populatedParticipants =
  Prisma.validator<Prisma.ConversationParticipantInclude>()({
    user: {
      select: {
        id: true,
        username: true,
      },
    },
  });

export const populatedConversation =
  Prisma.validator<Prisma.ConversationInclude>()({
    participants: {
      include: populatedParticipants,
    },
    latestMessage: {
      include: {
        sender: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    },
  });
