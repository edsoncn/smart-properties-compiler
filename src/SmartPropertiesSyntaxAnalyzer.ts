import { SmartPropertiesLexicalAnalyzer } from './SmartPropertiesLexicalAnalyzer'
import { SmartPropertiesSemanticAnalyzer } from './SmartPropertiesSemanticAnalyzer';
import { SmartPropertiesUtils } from './SmartPropertiesUtils'
import { SmartPropertiesWords } from './SmartPropertiesWords';
import { Block, Token, Variable, Assignment, Funct, Node } from './SmartPropertiesCompiler'

export class SmartPropertiesSyntaxAnalyzer{

    private lexicalAnalyzer: SmartPropertiesLexicalAnalyzer;
    private token: Token;
    private error: SyntaxError | null;

    private semanticProgramBlock: Block | null;
    private semanticBlockStack: Array<Block>;
    private semanticFunctionStack: Array<Funct>;

    private tokenQueue: Array<Token>;
    private semanticAnalizer: SmartPropertiesSemanticAnalyzer;
    
    constructor(code: string, semanticAnalizer: SmartPropertiesSemanticAnalyzer){
        this.lexicalAnalyzer = new SmartPropertiesLexicalAnalyzer(code);
        this.semanticAnalizer = semanticAnalizer;
        this.token = new Token(SmartPropertiesLexicalAnalyzer.EMPTY, Token.END_OF_FILE, 0, -1);
        this.error = null;
        this.semanticProgramBlock = null;
        this.semanticBlockStack = [];
        this.semanticFunctionStack = [];
        this.tokenQueue = [];
    }

    public nextToken(): Token {
        let token: Token = this.lexicalAnalyzer.nextToken();
        
        if(token.isError()){
            this.setError(token, 'Syntax Error There is an Lexical error');
        }else{
            this.tokenQueue.push(token);
            console.info('> token value: ' + token.getValue() + ', type: ' + token.getType() + ', lineCount: ' + token.getLine());
        }
        return token;
    }

    public execute() {
        this.program();
    }

    public program() {
        console.info('Syntax init');

        // Semantic
        this.semanticProgramBlock = new Block();
        this.semanticProgramBlock.setName("program");
        this.semanticBlockStack.push(this.semanticProgramBlock);
        
        this.block();
        if(this.checkError()) return;

        // Semantic
        this.semanticBlockStack.pop();
        
        if(this.token.isNotEndOfFile()){
            this.setError(this.token, 'Syntax Error Missing end of program');
        }else{
            console.info('Syntax success');
        }

    }

    protected block() {
        
        do{
            this.token = this.nextToken();
            if(this.checkError()) return;

            if(this.token.isEndOfFile() || this.isEnd(this.token) || this.isElse(this.token)){
                return;
            }else if(this.token.isVariable()){
                this.assignments();
                if(this.checkError()) return;
            }else if(this.isIf(this.token)){
                this.blockIf(false);
                if(this.checkError()) return;
            }else if(this.isWhile(this.token)){
                this.blockWhile();
                if(this.checkError()) return;
            }else if(this.isFunction(this.token)){
                this.functionInstruction();
                if(this.checkError()) return;
            }else if(this.isReturn(this.token)){
                break;
            }else{
                this.setError(this.token, 'Syntax Error Unknown token in block');
                return;
            }
        }while(true);

        this['return']();
        if(this.checkError()) return;

        this.token = this.nextToken();
        if(this.checkError()) return;

        if(!(this.token.isEndOfFile() || this.isEnd(this.token) || this.isElse(this.token))){
            this.setError(this.token, 'Syntax Error Missing end of the block');
        }

    }

    protected assignments(){
        if(this.token.isNotVariable()){
            this.setError(this.token, 'Syntax Error Missing variable in assignments');
            return;
        }

        // Semantic
        let assignment: Assignment = new Assignment(new Variable(this.token.getValue()));

        this.token = this.nextToken();
        if(this.checkError()) return;
            
        if(this.token.isNotAssignedSymbol()){
            this.setError(this.token, 'Syntax Error Missing assigment symbol ' + Token.ASSIGN_SYMBOL + ' in assigment');
            return;
        }

        // Semantic
        this.resetTokenQueue();

        this.expression();
        if(this.checkError()) return;

        // Semantic
        assignment.setExpression(this.semanticAnalizer.expressionEvaluateGetNode(this.tokenQueue));
        this.getParentBlock().getInstructions()!.push(assignment);
        
        if(this.token.isNotEndOfLine()){
            this.setError(this.token, 'Syntax Error Missing end of line in assigment');
        }        
    }

    protected expression(insideParenthesis: boolean = false, insideFunction: boolean = false){
        this.a(insideFunction);
        if(this.checkError()) return;

        if(this.token.isOperatorAll()){
            this.b();
            if(this.checkError()) return;
        }

        if(insideParenthesis){
            if(this.token.isNotCloseParenthesis()){
                this.setError(this.token, 'Syntax Error Missing close parenthesis in expression');
                return;
            }
            this.token = this.nextToken();            
            if(this.checkError()) return;
        }
    }

    protected a(insideFunction: boolean = false){
        console.info('>> a');
        this.token = this.nextToken();
        if(this.checkError()) return;

        if(this.token.isSign() || this.token.isLogicalNotOperator()){
            this.handleSignOrNot();
            this.token = this.nextToken();
            if(this.checkError()) return;
        }

        if(this.token.isValue() || this.token.isVariable() || this.token.isString()){
            this.token = this.nextToken();
            if(this.checkError()) return;
        } else if (this.token.isOpenParenthesis()){
            this.expression(true);
            if(this.checkError()) return;
        } else if(this.isFunction(this.token)){
            let funct: Funct = new Funct(this.getFirstFunctionName(this.token.getValue()));   
            this.function(funct);
            if(this.checkError()) return;
            this.semanticFunctionStack.push(funct);
        } else if (insideFunction){
            if(this.token.isNotCloseParenthesis() && this.token.isNotComma()){
                this.setError(this.token, 'Syntax Error Unknown token in a');
            }
        } else {
            this.setError(this.token, 'Syntax Error Unknown token in a');
        }
    }

    protected b(){
        console.info('>> b');
        this.expression();
        if(this.checkError()) return;
    }

    protected blockIf(isElseIf: boolean){
        console.info('>> blockIf');

        // Semantic
        let newBlock : Block = new Block();
        
        newBlock.setName(isElseIf ? "else-if" : "if");
        this.getParentBlock().getInstructions()!.push(newBlock);
        this.semanticBlockStack.push(newBlock);

        if(this.isNotIf(this.token)){
            this.setError(this.token, 'Syntax Error Missing ' + SmartPropertiesWords.IC_IF + ' in if control instruction');
            return;
        }

        this.condition();
        if(this.checkError()) return;
          
        if(this.isNotThen(this.token)){
            this.setError(this.token, 'Syntax Error Missing ' + SmartPropertiesWords.IC_THEN + ' in if control instruction');
            return;
        }

        this.token = this.nextToken();
        if(this.checkError()) return;
                  
        if(this.token.isNotEndOfLine()){
            this.setError(this.token, 'Syntax Error Missing end of file in if control instruction');
            return;
        }

        this.block();
        if(this.checkError()) return;

        if(this.isElse(this.token)){
            
            // Semantic
            this.semanticBlockStack.pop();
            
            this.token = this.nextToken();
            if(this.checkError()) return;       

            if(this.isIf(this.token)){
                this.blockIf(true);
                return;
            }else{
                if(this.token.isNotEndOfLine()){
                    this.setError(this.token, 'Syntax Error Missing end of file for else in if control instruction');
                    return;
                }
    
                // Semantic
                let elseBlock : Block = new Block();
                
                elseBlock.setName("else");
                this.getParentBlock().getInstructions()!.push(elseBlock);
                this.semanticBlockStack.push(elseBlock);
    
                this.block();
                if(this.checkError()) return;
                    
                if(this.isNotEnd(this.token)){
                    this.setError(this.token, 'Syntax Error Missing ' + SmartPropertiesWords.IC_END + ' in if control instruction');
                    return;
                }
        
                this.token = this.nextToken();
                if(this.checkError()) return;
            
                if(this.token.isNotEndOfLine()){
                    this.setError(this.token, 'Syntax Error Missing end of file for end in if control instruction');
                    return;
                }
        
                // Semantic
                this.semanticBlockStack.pop();
            }
        } else {

            if(this.isNotEnd(this.token)){
                this.setError(this.token, 'Syntax Error Missing ' + SmartPropertiesWords.IC_END + ' in if control instruction');
                return;
            }
    
            this.token = this.nextToken();            
            if(this.checkError()) return;
            
            if(this.token.isNotEndOfLine()){
                this.setError(this.token, 'Syntax Error Missing end of file for end in if control instruction');
                return;
            }
    
            // Semantic
            this.semanticBlockStack.pop();
        }
    }

    protected blockWhile(){
        console.info('>> blockWhile');

        // Semantic
        let newBlock : Block = new Block();
        
        newBlock.setName("while");
        this.getParentBlock().getInstructions()!.push(newBlock);        
        this.semanticBlockStack.push(newBlock);

        if(this.isNotWhile(this.token)){
            this.setError(this.token, 'Syntax Error Missing ' + SmartPropertiesWords.IC_WHILE + ' in while control instruction');
            return;
        }

        this.condition();
        if(this.checkError()) return;

        if(this.isNotThen(this.token)){
            this.setError(this.token, 'Syntax Error Missing ' + SmartPropertiesWords.IC_THEN + ' in while control instruction');
            return;
        }

        this.token = this.nextToken();
        if(this.checkError()) return;
            
        if(this.token.isNotEndOfLine()){
            this.setError(this.token, 'Syntax Error Missing end of file while in control instruction');
            return;
        }

        this.block();
        if(this.checkError()) return;

        if(this.isNotEnd(this.token)){
            this.setError(this.token, 'Syntax Error Missing ' + SmartPropertiesWords.IC_END + ' in while control instruction');
            return;
        }

        this.token = this.nextToken();
        if(this.checkError()) return;
            
        if(this.token.isNotEndOfLine()){
            this.setError(this.token, 'Syntax Error Missing end of file for end in while control instruction');
            return;
        }

        // Semantic
        this.semanticBlockStack.pop();

    }

    protected condition(){
        console.info('>> condition');

        // Semantic
        this.resetTokenQueue();

        this.expression();
        if(this.checkError()) return;

        // Semantic
        this.tokenQueue.pop();
        this.getParentBlock().setCondition(this.semanticAnalizer.expressionEvaluateGetNode(this.tokenQueue));
    }
    
    protected functionInstruction(){
        console.info('>> functionInstruction');
        
        // Semantic
        let funct: Funct = new Funct(this.getFirstFunctionName(this.token.getValue()));        
        this.function(funct);
        
        if(this.token.isNotEndOfLine()){
            this.setError(this.token, 'Syntax Error Missing end of line in function instruction');
        }
        
        // Semantic
        this.getParentBlock().getInstructions()!.push(funct);
    }
    
    protected function(funct: Funct){
        console.info('>> functionInstruction');
    
        if(this.isNotFunction(this.token)){
            this.setError(this.token, 'Syntax Error Unknow Function Name');
            return;
        }
        
        // Semantic save tokens
        let tokenQueueAux: Array<Token> = [];
        tokenQueueAux = tokenQueueAux.concat(this.tokenQueue);
    
        this.token = this.nextToken();
        if(this.checkError()) return;
            
        if(this.token.isNotOpenParenthesis()){
            this.setError(this.token, 'Syntax Error Missing open parenthesis in function');
            return;
        }
        
        do{
            // Semantic
            this.resetTokenQueue();
  
            this.expression(false, true);
            if(this.checkError()) return;
            
            console.log("TOKEN QUEUE");
            console.log(this.tokenQueue);
            // Semantic
            this.tokenQueue.pop();
            
            let resultNode: Node = this.semanticAnalizer.expressionEvaluateGetNode(this.tokenQueue);
            
            if(resultNode){
                funct.getParameters().push(resultNode);
            }
        
            if(this.token.isCloseParenthesis()){
                // Semantic reset and restore tokens
                this.resetTokenQueue();
                this.tokenQueue = this.tokenQueue.concat(tokenQueueAux);
              
                this.token = this.nextToken();
                if(this.checkError()) return;
                break;
            }else if(this.token.isNotComma()){
                this.setError(this.token, 'Syntax Error Missing comma in function');
                return;
            }
        }while(true);
    }

    protected 'return'(){
        if(this.isNotReturn(this.token)){
            this.setError(this.token, 'Syntax Error Missing ' + SmartPropertiesWords.IC_RETURN + ' in return');
            return;
        }

        // Semantic
        this.resetTokenQueue();

        this.expression();
        if(this.checkError()) return;

        // Semantic
        this.getParentBlock().setReturn(this.semanticAnalizer.expressionEvaluateGetNode(this.tokenQueue));

        if(this.token.isNotEndOfLine()){
            this.setError(this.token, 'Syntax Error Missing end of line in return');
        }
    }

    protected handleSignOrNot() {
        this.tokenQueue.pop();

        if(this.token.getValue() === '-'){
            this.tokenQueue.push(new Token('-1', Token.VALUE, this.token.getLine(), -1))
            this.tokenQueue.push(new Token('*', Token.SYMBOL, this.token.getLine(), -1))
        } else if(this.token.isLogicalNotOperator()){
            this.tokenQueue.push(new Token(SmartPropertiesWords.BOOL_FALSE[0], Token.VALUE, this.token.getLine(), -1))
            this.tokenQueue.push(new Token(SmartPropertiesWords.LOG_OP_NOT[0], Token.SYMBOL, this.token.getLine(), -1))
        }
    }

    protected isIf(token: Token): boolean{
        return SmartPropertiesUtils.equals(token, SmartPropertiesWords.IC_IF)
    }

    protected isNotIf(token: Token): boolean{
        return !this.isIf(token);
    }

    protected isElse(token: Token): boolean{
        return SmartPropertiesUtils.equals(token, SmartPropertiesWords.IC_ELSE)
    }

    protected isNotElse(token: Token): boolean {
        return !this.isElse(token);
    }

    protected isWhile(token: Token): boolean{
        return SmartPropertiesUtils.equals(token, SmartPropertiesWords.IC_WHILE)
    }

    protected isNotWhile(token: Token): boolean{
        return !this.isWhile(token);
    }

    protected isThen(token: Token): boolean{
        return SmartPropertiesUtils.equals(token, SmartPropertiesWords.IC_THEN)
    }

    protected isNotThen(token: Token): boolean {
        return !this.isThen(token);
    }

    protected isReturn(token: Token): boolean{
        return SmartPropertiesUtils.equals(token, SmartPropertiesWords.IC_RETURN)
    }

    protected isNotReturn(token: Token): boolean {
        return !this.isReturn(token);
    }
    protected isEnd(token: Token): boolean{
        return SmartPropertiesUtils.equals(token, SmartPropertiesWords.IC_END)
    }

    protected isNotEnd(token: Token): boolean{
        return !this.isEnd(token);
    }

    protected isFunction(token: Token): boolean{
        return SmartPropertiesSyntaxAnalyzer.validateFunction(token);
    }
    
    protected isNotFunction(token: Token): boolean{
        return !this.isFunction(token);
    }
  
    public static validateFunction(token: Token): boolean{
        if(token.isReserved()){
            for(let f of SmartPropertiesWords.FUNCTIONS){
                for(let name of f){
                    if(token.getValue().toUpperCase() === name){
                        return true;
                    }
                }
            }
        }
        return false;
    }
  
    protected getFirstFunctionName(name: string): string{
        let nameUpper = name.toUpperCase();
          
        for(let f of SmartPropertiesWords.FUNCTIONS){
            for(let n of f){
                if(nameUpper === n){
                    return f[0].toLowerCase();
                }
            }
        }
        return '';
    }
  
    public checkError(){
        return this.error != null;
    }

    protected setError(token: Token, message: string){
        this.error = new SyntaxError(token, message);
        this.error.showMessage();
    }
    
    public getErrorMessage(){
        return this.error!.getMessage();
    }

    protected resetTokenQueue(){
        this.tokenQueue = [];
    }

    // Semantic
    
    public getSemanticProgramBlock(): Block | null{
        return this.semanticProgramBlock;
    }
  
    public getSemanticFunctionStack(): Array<Funct>{
        return this.semanticFunctionStack;
    }
  
    protected getParentBlock(){
        let parentBlock: Block = this.semanticBlockStack.pop()!;
        this.semanticBlockStack.push(parentBlock!);
        return parentBlock;
    }
    
}

class SyntaxError {

    private token: Token;
    private message: string;

    constructor(token: Token, message: string){
        this.token = token;
        this.message = message;
    }

    public getMessage(): string {
        return this.message + ': token: ' + this.token.getValue() + ', line: ' + this.token.getLine() + ', type: ' + this.token.getType();
    }

    public showMessage() {
        console.error(this.getMessage());
    }

}
