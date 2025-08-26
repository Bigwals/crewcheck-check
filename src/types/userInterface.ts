export interface User {
    id: string;
    airline: string,
    crewId: string,
    firstName: string,
    lastName: string,
    telephone: string,
    commuterAirportCode: string,
    otp: number,
    otpVerified: boolean,
    isActive: boolean,
    email: string;
    password: string;
}