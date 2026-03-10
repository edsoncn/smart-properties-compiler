import { SmartPropertiesLexicalAnalyzerBase } from './SmartPropertiesLexicalAnalyzerBase'
import { Token } from './SmartPropertiesCompiler'
import { SmartPropertiesUtils } from './SmartPropertiesUtils';
import { SmartPropertiesWords } from './SmartPropertiesWords';

/**
 * Lexical Analyzer
 * for Smart Properties
 */    
export class SmartPropertiesLexicalAnalyzer extends SmartPropertiesLexicalAnalyzerBase{

    public static TEST_SYMBOL = '>=<=+-*/(),';
    public static TEST_COMPARE_NO_EQUALS = '><';
    
    private prevValue: String;

    constructor(text: string){
        let states = [ //         0  1  2  3  4  5  6  7  8  9  0  1  2  3  4
            // state \ element    "  _  \  S  L  d  E  A  . <> = !<> !=  / !/
            /**    s0       **/ [ 3,-1,-1, 0, 1, 2, 0,-1,-1, 7,-1,-1,-1, 9,-1], //
            /**    s1       **/ [-1, 1,-1, 0, 1, 1, 0,-1,-1,-1,-1,-1,-1,-1,-1], //
            /**    s2       **/ [-1,-1,-1, 0,-1, 2, 0,-1, 5,-1,-1,-1,-1,-1,-1], //
            /**    s3       **/ [ 0,-1, 4,-1,-1,-1,-1, 3,-1,-1,-1,-1,-1,-1,-1], //
            /**    s4       **/ [ 3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1], //
            /**    s5       **/ [-1,-1,-1,-1,-1, 6,-1,-1,-1,-1,-1,-1,-1,-1,-1], //
            /**    s6       **/ [-1,-1,-1, 0,-1, 6, 0,-1,-1,-1,-1,-1,-1,-1,-1], //
            /**    s7       **/ [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1, 8, 0,-1,-1,-1], //
            /**    s8       **/ [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1, 0,-1,-1], //
            /**    s9       **/ [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10, 0], //
            /**    s10      **/ [-1,-1,-1,-1,-1,-1, 0,10,-1,-1,-1,-1,-1,-1,-1], //
        ];
        let statesAction = [
            // states actions
            //  - 0: continue, 1: end and go back, 2: end and next, 3: end and start again
            // last state \ new state  s0 s1 s2 s3 s4 s5 s6 s7 s8 s9 s10
            /**      s0           **/ [ 2, 0, 0, 0,-1,-1,-1, 0,-1, 0,-1], //
            /**      s1           **/ [ 1, 0,-1,-1,-1,-1,-1,-1,-1,-1,-1], //
            /**      s2           **/ [ 1,-1, 0,-1,-1, 0,-1,-1,-1,-1,-1], //
            /**      s3           **/ [ 2,-1,-1, 0, 0,-1,-1,-1,-1,-1,-1], //
            /**      s4           **/ [-1,-1,-1, 0,-1,-1,-1,-1,-1,-1,-1], //
            /**      s5           **/ [-1,-1,-1,-1,-1,-1, 0,-1,-1,-1,-1], //
            /**      s6           **/ [ 1,-1,-1,-1,-1,-1, 0,-1,-1,-1,-1], //
            /**      s7           **/ [ 1,-1,-1,-1,-1,-1,-1,-1, 0,-1,-1], //
            /**      s8           **/ [ 1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1], //
            /**      s9           **/ [ 1,-1,-1,-1,-1,-1,-1,-1,-1,-1, 0], //
            /**      s10          **/ [ 1,-1,-1,-1,-1,-1,-1,-1,-1,-1, 0]  //
        ];
        super(text, states, statesAction);
        this.prevValue = SmartPropertiesLexicalAnalyzerBase.NEW_LINE;
    }

    public nextToken(): Token {
        let tokenObj: Token = super.nextTokenAll();
        
        console.log('TOKEN ALL > value: ' + tokenObj.getValue() + ', line: ' + tokenObj.getLine());
        if(tokenObj.getType() !== Token.ERROR){
            if(tokenObj.getValue() === SmartPropertiesLexicalAnalyzerBase.NEW_LINE){ // Is new line
                if(this.prevValue !== SmartPropertiesLexicalAnalyzerBase.NEW_LINE){
                    tokenObj.setType(Token.END_OF_LINE);
                }else{ // Skip if previous token was a new line
                    tokenObj = this.nextToken();
                }
            }else if(/^\s+$/.test(tokenObj.getValue())){
                tokenObj = this.nextToken();
            }else if(tokenObj.getType() === Token.COMMENT){
                tokenObj = this.nextToken();
            }
        }
        this.prevValue = tokenObj.getValue();

        return tokenObj;
    }
    
    protected getTokenType(token: string): number {
        let type: number = super.getTokenType(token);
        
        if(type === Token.VALUE){
            if(SmartPropertiesLexicalAnalyzer.TEST_SYMBOL.indexOf(token) >= 0){
                type = Token.SYMBOL;
            }
        }else if(type === Token.RESERVED){
            if(SmartPropertiesUtils.equalsToken(token, SmartPropertiesWords.BOOL_TRUE) || SmartPropertiesUtils.equalsToken(token, SmartPropertiesWords.BOOL_FALSE)){
                type = Token.VALUE;
            }
        }
        
        return type;
    }
    
    protected getPosition(character: string): number{
        let position: number;
        if(this.getState() === 3){
            switch (character) {
                case '"'    : position = 0; break;
                case '\\'   : position = 2; break;
                default: 
                    if(/\n/.test(character)){
                        position = -1;
                    }else{
                        position = 7;
                    }
            }
        }else if(this.getState() === 4){
            switch (character) {
                case '"'    : 
                case 'n'    : 
                case 't'    : position = 0; break;
                default:
                    position = -1;
            }
        }else if(this.getState() === 0 && SmartPropertiesLexicalAnalyzer.TEST_COMPARE_NO_EQUALS.indexOf(character) >= 0) {
            position = 9;
        }else if(this.getState() === 7 && character === '=') {
            position = 10;
        }else if(this.getState() === 7 && SmartPropertiesLexicalAnalyzer.TEST_COMPARE_NO_EQUALS.indexOf(character) < 0) {
            position = 11;
        }else if(this.getState() === 8 && character !== '=') {
            position = 12;
        }else if(this.getState() === 10){
            if(/\n/.test(character)){
                position = 6;
            }else{
                position = 7;
            }
        }else if(this.getState() === 9 && character !== '/') {
            position = 14;
        }else if((this.getState() === 9 || this.getState() === 0) && character === '/') {
            position = 13;
        }else{
            switch (character) {
                case '"'    : position = 0; break;
                case '_'    : position = 1; break;
                case '\\'   : position = 2; break;
                case '.'    : position = 8; break;
                default: 
                    if(SmartPropertiesLexicalAnalyzer.TEST_SYMBOL.indexOf(character) >= 0){
                        position = 3;
                    } else if(/[a-zA-Z]/.test(character)){
                        position = 4;
                    } else if(/[0-9]/.test(character)){
                        position = 5;
                    } else if(/\s/.test(character)){
                        position = 6;
                    }else{
                        position = -1;
                    }
            }
        }
        //console.log(' - position: ' + position); 
        return position;
    }

}
