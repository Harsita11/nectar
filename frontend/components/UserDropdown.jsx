"use client";

import { UserButton } from "@clerk/nextjs";
import { Refrigerator, Cookie } from "lucide-react";
import React, { useEffect, useState } from "react";

const UserDropdown = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render an inert placeholder of the same size until client-mounted, so
  // the server-rendered HTML matches the client's first paint exactly.
  // Clerk's UserButton injects its own DOM imperatively, which otherwise
  // causes a hydration mismatch warning on this subtree.
  if (!mounted) {
    return <div className="w-8 h-8 rounded-full bg-stone-200" aria-hidden="true" />;
  }

  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Link
          label="My Recipes"
          labelIcon={<Cookie size={16} />}
          href="/recipes"
        />
        <UserButton.Link
          label="My Pantry"
          labelIcon={<Refrigerator size={16} />}
          href="/pantry"
        />
        <UserButton.Action label="manageAccount" />
      </UserButton.MenuItems>
    </UserButton>
  );
};

export default UserDropdown;