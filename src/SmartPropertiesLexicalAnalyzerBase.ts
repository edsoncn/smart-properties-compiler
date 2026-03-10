import { Token } from './SmartPropertiesCompiler'

export abstract class SmartPropertiesLexicalAnalyzerBase {

    public static EMPTY = '';
    public static NEW_LINE = '\n';

    protected text: string;
    protected state: number;
    protected states: Array<Array<number>>;
    protected statesAction: Array<Array<number>>;
    protected token: string;
    protected tokens: Array<Token> = [];

    private charIndex: number;
    private lastState: number;
    private lineCount: number;

    protected constructor(text: string, states: Array<Array<number>>, statesAction: Array<Array<number>>){
        this.text = text;
        this.state = 0;
        this.states = states;
        this.statesAction = statesAction;
        this.token = SmartPropertiesLexicalAnalyzerBase.EMPTY;
        this.charIndex = 0;
        this.lastState = -1
        this.lineCount = 1;
    }

    protected nextTokenAll(): Token {
        let character = this.getChar();
        let tokenObj: Token;
        
        //console.log('Next Token');
        while(character !== SmartPropertiesLexicalAnalyzerBase.EMPTY){
            //console.log('> character: ' + character);            
            
            let position = this.getPosition(character); 
            
            if(position < 0){
                console.log('Error: incorrect character at line ' + this.lineCount + ' and position ' + this.charIndex);
                return new Token('Lexical Error in line ' + this.lineCount + ' and position ' + this.charIndex, Token.ERROR, this.lineCount, this.charIndex);
            }
            
            this.changeState(this.getNextState(this.getState(), position));
            if(this.getState() < 0){
                console.log('Error: incorrect state');
                return new Token('Lexical Error in line ' + this.lineCount + ' and position ' + this.charIndex, Token.ERROR, this.lineCount, this.charIndex);
            }

            // states actions
            //  - 0: continue, 1: end and go back, 2: end and next, 3: end and start again
            let action = this.getStateAction();
            switch (action) {
                case 0: 
                    this.token += character;
                    this.increaseCharIndex();
                    break;
                case 1:
                    // variable by default, the correct type will be setted later
                    tokenObj = this.createToken(this.charIndex - 1); 
                    this.token = SmartPropertiesLexicalAnalyzerBase.EMPTY;
                    return tokenObj;
                case 2:
                    this.token += character;
                    tokenObj = this.createToken(this.charIndex);
                    this.token = SmartPropertiesLexicalAnalyzerBase.EMPTY;
                    this.increaseCharIndex();
                    this.validateLineCount(character);
                    return tokenObj;
                case 3:
                    this.token += character;
                    tokenObj = this.createToken(this.charIndex);
                    this.token = SmartPropertiesLexicalAnalyzerBase.EMPTY;
                    this.increaseCharIndex();
                    this.validateLineCount(character);
                    this.changeState(0);
                    return tokenObj;
            }

            // character update  
            character = this.getChar();
        }

        tokenObj = new Token(SmartPropertiesLexicalAnalyzerBase.EMPTY, Token.END_OF_FILE, this.lineCount, this.charIndex);
        return tokenObj;
    }

    public execute(): void {
        console.log('Executing Lexical');

        let tokenObj: Token;
        do {
            tokenObj = this.nextTokenAll();

            //console.log(' - token value: ' + tokenObj.getValue() + ', type: ' + tokenObj.getType() + ', lineCount: ' + tokenObj.getLine());
            if(tokenObj.getType() === Token.ERROR){
                return;
            }
            
            this.addToken(tokenObj);
        } while (tokenObj.getType() >= 0);
        /** 
        console.log('Token List:');
        for(let i = 0; i < this.tokens.length; i++){
            tokenObj = this.tokens[i];
            console.log('> Token value: ' + tokenObj.getValue() + ', type: ' + tokenObj.getType() + ', lineCount: ' + tokenObj.getLine());
        }
        **/
    }

    protected createToken(lastCharIndex: number){
        return new Token(this.token, this.getTokenType(this.token), this.lineCount, lastCharIndex);
    }

    protected getTokenType(token: string): number {
        if(/^[A-Z]/.test(token)){ // Validate first letter uppercase
            return Token.RESERVED;
        } else if(/^[a-z]/.test(token)){ // Validate first letter lowercase
            return Token.VARIABLE;
        } else if(/^\/\//.test(token)){ // Validate comment
            return Token.COMMENT;
        } else {
            return Token.VALUE;
        }
    }
    
    protected getChar(): string {
        //console.log(' - charIndex: ' + this.charIndex)        
        if(this.charIndex >= 0 && this.charIndex < this.getTextSize()){
            return this.text.charAt(this.charIndex);
        }else if(this.charIndex === this.getTextSize()){
            if(this.text.charAt(this.getTextSize() - 1) === SmartPropertiesLexicalAnalyzerBase.NEW_LINE){
                return SmartPropertiesLexicalAnalyzerBase.EMPTY;
            }else{
                return SmartPropertiesLexicalAnalyzerBase.NEW_LINE;
            }
        }else{
            return SmartPropertiesLexicalAnalyzerBase.EMPTY;
        }
    }

    protected abstract getPosition(character: string): number;

    protected getTextSize(): number {
        return this.text.length;
    }

    protected increaseCharIndex(): void {
        this.charIndex++;
    }
    
    protected validateLineCount(character: string){
        if(character === SmartPropertiesLexicalAnalyzerBase.NEW_LINE) this.lineCount++;
    }

    protected addToken(token: Token): void {
        this.tokens.push(token);
    }

    protected getState(): number {
        return this.state;
    }

    protected getLastState(): number {
        return this.lastState;
    }

    protected changeState(state: number): void {
        //console.log(' - state: ' + this.state);
        //console.log(' - new state: ' + state);
        this.lastState = this.state;
        this.state = state;
    }

    protected getNextState(state: number, position: number){
        return this.states[state][position];
    }

    protected getStateAction(): number{
        let action = this.statesAction[this.getLastState()][this.getState()];

        //console.log(' - action: ' + action);
        return action; 
    }

    public getTokens(): Array<Token> {
        return this.tokens;
    }

}
