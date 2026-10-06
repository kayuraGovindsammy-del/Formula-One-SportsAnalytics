import type { ReactNode } from "react";
import Navbar from "./Navbar";
import ChatWidget from "../chat/ChatWidget";

type LayoutProps = {
  children: ReactNode;
};

function Layout({ children }: LayoutProps) {
  return (
    <>
      <Navbar />

      <div className="page-container">
        {children}
      </div>

      <ChatWidget />
    </>
  );
}

export default Layout;