const privateString: string = "PrivateString";

type PrivateType = {
  id: number;
  name: string;
  isActive: boolean;
};

export type PublicType = {
  id: number;
  description: string;
  details: PrivateType;
};

const privateNumber: number = 42;
const privateBoolean: boolean = true;

export const publicArray: string[] = ["apple", "banana", "cherry"];

export interface PublicInterface {
  id: number;
  value: string;
  related: PrivateType;
}

const privateFunction = (input: string): string => {
  return `${privateString} - ${input}`;
};

export const publicFunction = (input: number): string => {
  return privateFunction(`Number is ${input}`);
};
