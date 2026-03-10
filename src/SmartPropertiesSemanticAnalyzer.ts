import { SmartPropertiesSyntaxAnalyzer } from './SmartPropertiesSyntaxAnalyzer'
import { Block, Token, Node } from './SmartPropertiesCompiler'

export class SmartPropertiesSemanticAnalyzer{

    private program: Block | null;
    private syntaxAnalyzer: SmartPropertiesSyntaxAnalyzer;
    private errorMessage: null | string

    constructor(code: string){
        this.syntaxAnalyzer = new SmartPropertiesSyntaxAnalyzer(code, this);
        this.program = null;
        this.errorMessage = null;
    }

    public execute() {
        this.syntaxAnalyzer.execute();
        this.program = this.syntaxAnalyzer.getSemanticProgramBlock()!;
        
        // If there is no instructions or return (no code) then set null to clean Json
        if(!this.program.getReturn() && this.program.getInstructions()!.length === 0){
            this.program.setType(null);
            this.program.setName(null);
            this.program.setInstructions(null);
        }
        
        if(this.syntaxAnalyzer.checkError()){
            this.errorMessage = this.syntaxAnalyzer.getErrorMessage();
        }else{
            console.log("\nSemantic Program v2.9");
            console.log(this.getJSONString());
        }
    }
    
    public checkError() {
        return this.errorMessage != null;
    }
  
    public getErrorMessage(): string{
        return this.errorMessage!;
    }
    
    public getProgram(): Block | null{
        return this.program;
    }

    public expressionEvaluateGetNode(tokenQueue: Array<Token>): Node {
        let node: Node
        let stackOperators: Array<Token> = [];
        let stackChildNodes: Array<Node> = [];
        let end = false;

        while(tokenQueue.length > 0 && !end){
            let token: Token = tokenQueue.shift()!;

            if(token.isOpenParenthesis()){
                node = this.expressionEvaluateGetNode(tokenQueue);
                stackChildNodes.push(node);
            }else if(token.isCloseParenthesis() || token.isEndOfLine()){
                end = true;
            }else if(token.isOperatorAll()){
                let lastOperator: Token | undefined = stackOperators.pop();
                let nextOperator = token;

                if(lastOperator){
                    while(lastOperator && this.expressionOperatorsPriority(nextOperator) <= this.expressionOperatorsPriority(lastOperator)){
                        node = this.expressionBuildNewNode(lastOperator, stackChildNodes.pop()!, stackChildNodes.pop()!);
                        stackChildNodes.push(node);
                        lastOperator = stackOperators.pop();
                    }
                    if(lastOperator){
                        stackOperators.push(lastOperator);
                    }
                    stackOperators.push(nextOperator);
                }else{
                    stackOperators.push(token);
                }
            }else{
                node = new Node();
                this.expressionSetValue(node, token);
                stackChildNodes.push(node);
            }
        }

        let lastOperator: Token | undefined = stackOperators.pop();
        while(lastOperator){
            node = this.expressionBuildNewNode(lastOperator, stackChildNodes.pop()!, stackChildNodes.pop()!);
            stackChildNodes.push(node);
            lastOperator = stackOperators.pop();
        }

        return node!;
    }

    protected expressionBuildNewNode(operator: Token, nodeLeft: Node, nodeRight: Node): Node{
        let node = new Node();
        
        if(operator.isLogicalAndOperator()){
            node.setOperator('&');
        }else if(operator.isLogicalOrOperator()){
            node.setOperator('|');
        }else if(operator.isLogicalNotOperator()){
            node.setOperator('!');
        }else{
            node.setOperator(operator.getValue());
        }
        node.setLeft(nodeLeft);
        node.setRight(nodeRight);
        return node;
    }

    protected expressionOperatorsPriority(token: Token): number{
        if(token.isLogicalOperator()){
            return 0;
        } else if (token.isLogicalNotOperator()){
            return 4;
        } else {
            switch(token.getValue()){
                case '>':
                case '<':
                case '>=':
                case '<=':
                case '=':   return 1;
                case '+':
                case '-':   return 2;
                case '*':
                case '/':   return 3;
            }
            return 0;
        }
    }

    protected expressionSetValue(node: Node, token: Token){
        if(token.isVariable()){
            node.setVariable(token.getValue());
        }else if(token.isString()){
            node.setValueString(JSON.parse(token.getValue()));
        }else if(token.isNumber()){
            if(token.getValue().indexOf('.') < 0) {
                node.setValueInt(Number(token.getValue()));
            }else{
                node.setValueFloat(Number(token.getValue()));
            }
        }else if(token.isBooleanTrue()){
            node.setValueBoolean(true);
        }else if(token.isBooleanFalse()){
            node.setValueBoolean(false);
        }else if(token.isReserved()){
            let funct = this.syntaxAnalyzer.getSemanticFunctionStack().shift()!
            node.setFunct(funct);
        }
    }

    public getJSONString(): string{
        return SmartPropertiesSemanticAnalyzer.getJSONString(this.program!);
    }
    
    public static getJSONString(program: Block): string{
        return JSON.stringify(program, (k, v) => {
            if(v !== null) {
                if(k === 'type'){
                    if(v === 'block' || v === 'assignment' || v === 'funct'){
                        return v;
                    }
                } else if (k !== 'line' && k.lastIndexOf('bool') !== 0){
                    return v;
                }
            }
        });
    }

}
