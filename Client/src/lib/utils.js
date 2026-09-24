export function formatMessageTime(date){
    return new Date(date).toLocaleTimeString("en-US", {hour: "2-digit", minute: "2-digit", 
        hour12: false})

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