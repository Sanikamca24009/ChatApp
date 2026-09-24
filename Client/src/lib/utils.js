export function formatMessageTime(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatSidebarTime(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const now = new Date();

  const isToday =
    now.getFullYear() === d.getFullYear() &&
    now.getMonth() === d.getMonth() &&
    now.getDate() === d.getDate();

  if (isToday) {
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === d.getFullYear() &&
    yesterday.getMonth() === d.getMonth() &&
    yesterday.getDate() === d.getDate();

  if (isYesterday) {
    return "Yesterday";
  }

  // Within the last 6 days: show short weekday (e.g., "Mon", "Tue")
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7 && diffDays > 0) {
    return d.toLocaleDateString("en-US", { weekday: "short" });
  }

  // Older: DD/MM/YY (e.g. 17/06/26)
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function formatDateDivider(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const isToday =
    now.getFullYear() === d.getFullYear() &&
    now.getMonth() === d.getMonth() &&
    now.getDate() === d.getDate();

  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === d.getFullYear() &&
    yesterday.getMonth() === d.getMonth() &&
    yesterday.getDate() === d.getDate();

  if (isYesterday) return "Yesterday";

  const sameYear = now.getFullYear() === d.getFullYear();
  if (sameYear) {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isDifferentDay(date1, date2) {
  if (!date1 || !date2) return true;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() !== d2.getFullYear() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getDate() !== d2.getDate()
  );
}

export function formatLastSeen(date) {
  if (!date) return "Offline";

  const d = new Date(date);
  if (isNaN(d.getTime())) return "Offline";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "Last seen just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `Last seen ${diffInMinutes} min ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  const isSameDay =
    now.getDate() === d.getDate() &&
    now.getMonth() === d.getMonth() &&
    now.getFullYear() === d.getFullYear();

  if (isSameDay) {
    return `Last seen ${diffInHours} hr${diffInHours > 1 ? "s" : ""} ago`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getDate() === d.getDate() &&
    yesterday.getMonth() === d.getMonth() &&
    yesterday.getFullYear() === d.getFullYear();

  if (isYesterday) {
    return "Last seen Yesterday";
  }

  const diffInDays = Math.floor(diffInSeconds / 86400);
  if (diffInDays < 7) {
    return `Last seen ${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
  }

  return `Last seen ${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}