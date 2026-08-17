import type { ReactNode } from "react";
import Navbar from "./Navbar";

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
    </>
  );
}

export default Layout;