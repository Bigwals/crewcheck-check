export const minutesToHHMM = (minutes: number = 0): string => {
    const hrs = Math.floor(minutes / 60)
        .toString()
        .padStart(2, "0");

    const mins = (minutes % 60)
        .toString()
        .padStart(2, "0");

    return `${hrs}:${mins}`;
};

export const dateToIntTime = (dateString: string): number => {
    const date = new Date(dateString);

    return (
        date.getHours() * 100 +
        date.getMinutes()
    );
};