import { Token } from './SmartPropertiesCompiler'

export class SmartPropertiesUtils{

    public static equalsToken(token: string, values: Array<string>): boolean{
        for(let value of values){
            if(this.validateReservedWord(token, value)){
                return true;
            }
        }
        return false;
    }

    public static equals(token: Token, values: Array<string>): boolean{
        return SmartPropertiesUtils.equalsToken(token.getValue(), values);
    }

    public static validateReservedWord(tokenValue: string, reservedWord: string): boolean{
        return tokenValue.charAt(0) === reservedWord.charAt(0) && tokenValue.toUpperCase() === reservedWord;
    }

}