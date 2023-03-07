import { signOut } from "next-auth/react";
import { FunctionComponent as FC } from "react";
import { Button, Center, Flex } from "@chakra-ui/react";
import { Session } from "next-auth";

interface WrapCurrentConversationProps {}

/* 
This wrapper component contains some core logic that can
be reused in its child components
*/

const WrapCurrentConversation: FC<WrapCurrentConversationProps> = () => {
  return <div>fda</div>;
};

export default WrapCurrentConversation;