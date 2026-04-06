export function formatDuration(ms: number): string {
    if (ms < 0) ms = 0;
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
  
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ${hours % 24} hr${hours % 24 !== 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hr${hours > 1 ? 's' : ''} ${minutes % 60} min`;
    return `${minutes} min`;
}
