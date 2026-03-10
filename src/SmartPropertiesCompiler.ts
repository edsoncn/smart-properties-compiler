import fetch from 'node-fetch'
import { SmartPropertiesLexicalAnalyzer } from './SmartPropertiesLexicalAnalyzer' 
import { SmartPropertiesSemanticAnalyzer } from './SmartPropertiesSemanticAnalyzer' 
import { SmartPropertiesSyntaxAnalyzer } from './SmartPropertiesSyntaxAnalyzer';
import { SmartPropertiesUtils } from './SmartPropertiesUtils';
import { SmartPropertiesWords } from './SmartPropertiesWords';

const ErrorCodes: Record<string, string> = {
    ERROR_001 : "Compile Error: {0}",
    ERROR_101 : "Compile Error Parameter {0} not found",
    ERROR_201 : "Compile Error The condition isn't a boolean expression",
    ERROR_301 : "Compile Error Inconsistent types in expression",
    ERROR_302 : "Compile Error Parameter type incorrect: {0}",
    ERROR_401 : "Compile Error Properties value wasn't returned in program",
    ERROR_402 : "Compile Error Properties class {0} doesn't match with returned type of program",
    ERROR_501 : "Compile Error Function parameter {0} has wrong type. Expect {1}, received {2}",
    ERROR_502 : "Compile Error Function {0} not found",
    ERROR_503 : "Compile Error Function wrong parameter size. Expect {0}, received {1}",
    ERROR_504 : "Compile Error Function missing return value. Function name: {0}",
    ERROR_505 : "Compile Error Function array index is out of. Expect index range [0...{0}], received {1}"
}
  
export default class SmartPropertiesApi {
    
    private smartPropertiesCodeMap: Record<string, Block>;
    private smartPropertiesCodeMapLoaded: boolean;
    private apiUrl: string;
    private tenant: string;
    private workspace: string;
    private apiToken: string
        
    constructor(apiUrl: string, tenant: string, workspace: string, apiToken: string){
        this.smartPropertiesCodeMap = {};
        this.smartPropertiesCodeMapLoaded = false;
        this.apiUrl = apiUrl;
        this.tenant = tenant;
        this.workspace = workspace;
        this.apiToken = apiToken;
    }

    public initialize(callback?: Function){
        this.loadSmartPropertiesCodeMap(callback);
    }
    
    public executeLexicalAnalyzer(code: string): Array<Token> {    
        let lexicalAnalyzer = new SmartPropertiesLexicalAnalyzer(code);
        
        lexicalAnalyzer.execute();
        return lexicalAnalyzer.getTokens();
    }
  
    public executeSemanticAnalyzer(code: string): Block | SmartPropertiesException {
        let analyzer: SmartPropertiesSemanticAnalyzer = new SmartPropertiesSemanticAnalyzer(code);
        
        analyzer.execute();            
        if(analyzer.checkError()){
          return new SmartPropertiesException(ErrorCodes.ERROR_001, [analyzer.getErrorMessage()]);
        }
    
        return analyzer.getProgram()!;
    }

    public compile(program: Block, variables: Array<Variable>, skipDefault: boolean): Value | null | SmartPropertiesException {
        let smartPropCompiler: SmartPropertiesCompiler = new SmartPropertiesCompiler(this);
        
        let result: Value | null | SmartPropertiesException = smartPropCompiler.compile(program, variables, skipDefault);
        let consoleStr: string = smartPropCompiler.getConsole();
        
        if(result instanceof SmartPropertiesException){
            return result;
        }
        
        if(consoleStr !== '') {
            console.log('Console > ');
            console.log(consoleStr);
        }
        if(smartPropCompiler.wasDefaultReturned()) {
            console.log('Default Value was returned!');
        }
        return result;
    }

    public getJSONString(program: Block): string{
        return SmartPropertiesSemanticAnalyzer.getJSONString(program);
    }
    
    public static validateFunction(token: Token): boolean{
        return SmartPropertiesSyntaxAnalyzer.validateFunction(token);
    }
    
    public loadSmartPropertiesCodeMap(callback?: Function){
        console.log('Loading Smart Property map');
        this.callSmartPropertiesCodesService().then((result: any) => {
            this.setSmartPropertiesCodeData(result);
            if(callback){
                callback();
            }
        });
    }

    public setSmartPropertiesCodeData(result: any) {
        for(let smartProperty of result){
            console.log(' > ' + smartProperty.key);
            if(smartProperty.code){
                this.smartPropertiesCodeMap[smartProperty.key] = SmartPropertiesCompiler.parseBlock(JSON.parse(smartProperty.code));
            }
        }
    }
  
    public isSmartPropMapLoaded(): boolean{
        return this.smartPropertiesCodeMapLoaded;
    }
    
    public getSmartPropertiesCodeBlockByKey(key: string): Block{
        return this.smartPropertiesCodeMap[key];
    }
  
    public reset(){
        this.loadSmartPropertiesCodeMap();
    }
  
    private async callSmartPropertiesCodesService(){
        let url = this.apiUrl + '/' + this.tenant + '/smart-property-code/' + this.workspace;
        let response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.apiToken
            }
        });
        return await response.json();
    }
    
    public getSmartPropertiesCodeMap(): Record<string, Block>{
        return this.smartPropertiesCodeMap;
    }
    
}

export class SmartPropertiesCompiler {
    
    private smartPropertiesApi: SmartPropertiesApi
    private console: string;
    private defaultReturned: boolean;
    
    constructor(smartPropertiesApi: SmartPropertiesApi){    
        this.smartPropertiesApi = smartPropertiesApi;    
        this.defaultReturned = false;
        this.console = '';
    }
  
    public compile(program: Block, variables: Array<Variable>, skipDefault: boolean): Value | null | SmartPropertiesException {
        let existsDefaultValue: boolean = false;
        
        if(program.getDefaultValue() && program.getDefaultValue()!.isInitialized() && !skipDefault){
            existsDefaultValue = true;
        }
        if(program.getType() === null){
            if(existsDefaultValue) {
                this.defaultReturned = true;
                return program.getDefaultValue()!;
            } else {
                return null;
            }
        }
        
        let variablesMap: Record<string, Variable> = {};
        let returnVar: Variable = new Variable('');
        
        console.log('Variables IN :');
        for(let variable of variables) {
            console.log(' > name = ' + variable.getName() + ', value = ' + variable.toString());
            variablesMap[variable.getName()] = variable;
        }
        
        let result = this.compileBlock(program, variablesMap, returnVar);
        if(result instanceof SmartPropertiesException){
            if(existsDefaultValue) {
                this.defaultReturned = true;
                return program.getDefaultValue()!;
            } else {
                return result;
            }
        }
    
        for(let name in variablesMap){
            let value: Value = variablesMap[name];
            let varFound: boolean = false;
            
            for(let variable of variables){
                if(variable.getName() === name){
                    variable.setValue(value);
                    varFound = true;
                    break;
                }
            }
            
            if(!varFound){
                variables.push(variablesMap[name]);
            }
        }
    
        console.log('Variables OUT:');
        for(let variable of variables) {
            console.log(' > name = ' + variable.getName() + ', value = ' + variable.toString());
           variablesMap[variable.getName()] = variable;
        }
        
        if(returnVar.isInitialized()){
           return returnVar;
        }else if(existsDefaultValue) {
            this.defaultReturned = true;
            return program.getDefaultValue()!;
        } else {
            return null;
        }
    }

    private compileBlock(block: Block, variables: Record<string, Variable>, returnVar: Variable): undefined | SmartPropertiesException {
        if(block.getCondition() != null) {
            let value: Value | SmartPropertiesException = this.evaluateExpression(block.getCondition()!, variables, true);
            if(value instanceof Value){
                if(value.isValueBoolean()){
                    block.setConditionResult(value.getValueBoolean()!);
                    if(!block.getConditionResult()) {
                        return;
                    }
                }else{
                    return new SmartPropertiesException(ErrorCodes.ERROR_201, []);
                }
            } else {
                return value;
            }
        }

        let q: Array<Instruction> = [];
        q = q.concat(block.getInstructions()!);
      
        let lastIfCondition: null | boolean = null;
        while(q.length > 0) {
            let instruction: Instruction = q.shift()!;
        
            if (instruction instanceof Assignment) {
                let assignment: Assignment = instruction;
                let variable: Variable = assignment.getVariable();
                let expression: Node = assignment.getExpression();

                let value: Node | SmartPropertiesException = this.evaluateExpression(expression, variables);
                if(value instanceof Node){
                    variable.setValue(value);
                    variables[variable.getName()] = variable;
                    lastIfCondition = null;
                } else {
                    return value;
                }
            } else if (instruction instanceof Block) {
                let blockChild: Block = instruction;
                
                if(lastIfCondition != null && lastIfCondition && blockChild.getName()!.indexOf("else") >= 0) {
                  continue;
                }
              
                let result = this.compileBlock(blockChild, variables, returnVar);                
                if(result instanceof SmartPropertiesException){
                    return result;
                }

                if (returnVar.isInitialized()) {
                    return;
                }
                
                lastIfCondition = null;
                if(blockChild.getName()!.indexOf("if") >= 0) {
                    lastIfCondition = blockChild.getConditionResult()!;
                }
                
                if(blockChild.getName() === 'while' && blockChild.getConditionResult()) {
                    q.unshift(blockChild);
                }
            } else if(instruction instanceof Funct) {
                let funct: Funct = instruction;
                let result: Value | SmartPropertiesException = this.evaluateFunction(funct, variables);  
                   
                lastIfCondition = null;
                if(result instanceof SmartPropertiesException){
                    return result;
                }
            }
        }
        if (block.getReturn() != null) {
            let value: Value | SmartPropertiesException = this.evaluateExpression(block.getReturn()!, variables);
            if(value instanceof Value){
                returnVar.setValue(value);
            } else {
                return value;
            }
        }
    }

    private evaluateExpression(node: Node, variables: Record<string, Variable>, isBooleanOperator: boolean = false): Node | SmartPropertiesException {
        if(!this.hasChildren(node)){
            if(node.isVariable()){
                if(variables[node.getVariable()!]){
                    let varValue: Value = variables[node.getVariable()!];
                    
                    if(!isBooleanOperator || varValue.isValueBoolean()){
                        node.setValue(varValue);
                    }else{
                        node.setValueBoolean(true);
                    }
                }else{
                    if(!isBooleanOperator){
                        return new SmartPropertiesException(ErrorCodes.ERROR_101, [node.getVariable()!]);
                    }else{
                        node.setValueBoolean(false);
                    }
                }
            }else if(node.isFunction()){
                let funct: Funct = node.getFunct()!;
                let value: Value | SmartPropertiesException = this.evaluateFunction(funct, variables);
        
                if(value instanceof SmartPropertiesException){
                    return value;
                }else{
                    if(value.isInitialized()){
                        node.setValue(value);
                    }else{
                        return new SmartPropertiesException(ErrorCodes.ERROR_504, [funct.getName()]);
                    }
                }
            }
        }else{
            let result = this.operateNodeChildren(node, variables);
            if(result instanceof SmartPropertiesException){
                return result;
            }
        }
        return node;
    }
    
    private evaluateFunction(funct: Funct, variables: Record<string, Variable>): Value | SmartPropertiesException {
        let name: string = funct.getName();
        let paramValues: Array<Value> = [];
        
        for(let i=0; i < funct.getParameters().length; i++){
            let paramExpressin: Node = funct.getParameters()[i];
            let value: Node | SmartPropertiesException = this.evaluateExpression(paramExpressin, variables);
                  
            if(value instanceof SmartPropertiesException){
                return value;
            }else{
                paramValues.push(value);
            }
        }
    
        return this.executeFunction(name, paramValues, variables);
    }
  
    private executeFunction(name: string, paramValues: Array<Value>, variables: Record<string, Variable>): Value | SmartPropertiesException {
        switch(name){
            case 'call': return this.executeCallFunction(paramValues, variables);
            case 'sqrt': return this.executeSquareRootFunction(paramValues);
            case 'array': return this.executeArrayFunction(paramValues);
            case 'get': return this.executeGetFunction(paramValues);
            case 'length': return this.executeLengthFunction(paramValues);
            case 'push': return this.executePushFunction(paramValues);
            case 'pop': return this.executePopFunction(paramValues);
            case 'unshift': return this.executeUnshiftFunction(paramValues);
            case 'shift': return this.executeShiftFunction(paramValues);
            case 'pushall': return this.executePushAllFunction(paramValues);
            case 'print': return this.executePrintFunction(paramValues);
            default: return new SmartPropertiesException(ErrorCodes.ERROR_502, [name]);
        }
    }
  
    private executeCallFunction(paramValues: Array<Value>, variables: Record<string, Variable>): Value | SmartPropertiesException {
        let funcParamsLength = 1;
    
        if(paramValues.length !== funcParamsLength){
            return new SmartPropertiesException(ErrorCodes.ERROR_503, [funcParamsLength, paramValues.length]);
        }else{
            let param0: Value = paramValues[0];
            
            if(!param0.isValueString()){
                return new SmartPropertiesException(ErrorCodes.ERROR_501, [1, 'string', param0.getType()]);
            }else{
                let paramKey = param0.getValueString()!;
                let resultBlock: Block = this.smartPropertiesApi.getSmartPropertiesCodeBlockByKey(paramKey);
                let returnVar: Variable = new Variable('');  
                
                console.log(`Function call (${paramKey})`);
                let result = this.compileBlock(resultBlock, variables, returnVar);                      
                if(result instanceof SmartPropertiesException){
                    return result;
                }
                return returnVar;
            }
        }
    }
  
    private executeSquareRootFunction(paramValues: Array<Value>): Value | SmartPropertiesException {
        let funcParamsLength = 1;
        
        if(paramValues.length !== funcParamsLength){
            return new SmartPropertiesException(ErrorCodes.ERROR_503, [funcParamsLength, paramValues.length]);
        }else{
            let param0: Value = paramValues[0];
            
            if(!param0.isValueFloat() && !param0.isValueInt()){
                return new SmartPropertiesException(ErrorCodes.ERROR_501, [1, 'int/float', param0.getType()]);
            }else{
                let value: number = param0.isValueFloat() ? param0.getValueFloat()! : param0.getValueInt()!;
                let squareValue: Value = new Value();  
                
                squareValue.setValueFloat(Math.sqrt(value));
                return squareValue;
            }
        }
    }

    private executeArrayFunction(paramValues: Array<Value>): Value {
        let valueArray = new Value();
        valueArray.setValueArray(paramValues);
        
        return valueArray;
    }
    
    private executeGetFunction(paramValues: Array<Value>): Value | SmartPropertiesException {
        let funcParamsLength = 2;
        
        if(paramValues.length !== funcParamsLength){
            return new SmartPropertiesException(ErrorCodes.ERROR_503, [funcParamsLength, paramValues.length]);
        }else{
            let param0Array = paramValues[0];
            let param1Index = paramValues[1];
            
            if(!param0Array.isValueArray()){
                return new SmartPropertiesException(ErrorCodes.ERROR_501, [1, 'array', param0Array.getType()]);
            }else if(!param1Index.isValueInt()){
                return new SmartPropertiesException(ErrorCodes.ERROR_501, [2, 'int', param1Index.getType()]);
            }else{
                let index: number = param1Index.getValueInt()!;
                let arraySize: number = param0Array.getValueArray()!.length;
                
                if(index < 0 || index >= arraySize){
                    return new SmartPropertiesException(ErrorCodes.ERROR_505, [arraySize - 1, index]);
                }else{
                    let gettedValue = new Value();
                    gettedValue.setValue(param0Array.getValueArray()![index]);
                    
                    return gettedValue;
                }
            }
        }
    }
    
    private executeLengthFunction(paramValues: Array<Value>): Value | SmartPropertiesException {
        let funcParamsLength = 1;
        
        if(paramValues.length !== funcParamsLength){
            return new SmartPropertiesException(ErrorCodes.ERROR_503, [funcParamsLength, paramValues.length]);
        }else{
            let param0Array = paramValues[0];
            
            if(!param0Array.isValueArray()){
                return new SmartPropertiesException(ErrorCodes.ERROR_501, [1, 'array', param0Array.getType()]);
            }else{
                let lengthValue = new Value();
                lengthValue.setValueInt(param0Array.getValueArray()!.length);
                
                return lengthValue;
            }
        }
    }
    
    private executePushFunction(paramValues: Array<Value>): Value | SmartPropertiesException {
        let funcParamsLength = 2;
        
        if(paramValues.length !== funcParamsLength){
            return new SmartPropertiesException(ErrorCodes.ERROR_503, [funcParamsLength, paramValues.length]);
        }else{
            let param0Array = paramValues[0];
            let param1Value = paramValues[1];
            
            if(!param0Array.isValueArray()){
                return new SmartPropertiesException(ErrorCodes.ERROR_501, [1, 'array', param0Array.getType()]);
            }else{
                param0Array.getValueArray()!.push(param1Value);
                return new Value();
            }
        }
    }
    
    private executePopFunction(paramValues: Array<Value>): Value | SmartPropertiesException {
        let funcParamsLength = 1;
        
        if(paramValues.length !== funcParamsLength){
            return new SmartPropertiesException(ErrorCodes.ERROR_503, [funcParamsLength, paramValues.length]);
        }else{
            let param0Array = paramValues[0];
            
            if(!param0Array.isValueArray()){
                return new SmartPropertiesException(ErrorCodes.ERROR_501, [1, 'array', param0Array.getType()]);
            }else{
                let valueArray: Array<Value> = param0Array.getValueArray()!;
                
                if(valueArray.length > 0){
                    return valueArray.pop()!;
                }else{
                    return new Value();
                }
            }
        }
    }
    
    private executeUnshiftFunction(paramValues: Array<Value>): Value | SmartPropertiesException {
        let funcParamsLength = 2;
        
        if(paramValues.length !== funcParamsLength){
            return new SmartPropertiesException(ErrorCodes.ERROR_503, [funcParamsLength, paramValues.length]);
        }else{
            let param0Array = paramValues[0];
            let param1Value = paramValues[1];
            
            if(!param0Array.isValueArray()){
                return new SmartPropertiesException(ErrorCodes.ERROR_501, [1, 'array', param0Array.getType()]);
            }else{
                param0Array.getValueArray()!.unshift(param1Value);
                return new Value();
            }
        }
    }
    
    private executeShiftFunction(paramValues: Array<Value>): Value | SmartPropertiesException {
        let funcParamsLength = 1;
        
        if(paramValues.length !== funcParamsLength){
            return new SmartPropertiesException(ErrorCodes.ERROR_503, [funcParamsLength, paramValues.length]);
        }else{
            let param0Array = paramValues[0];
            
            if(!param0Array.isValueArray()){
                return new SmartPropertiesException(ErrorCodes.ERROR_501, [1, 'array', param0Array.getType()]);
            }else{
                let valueArray: Array<Value> = param0Array.getValueArray()!;
                
                if(valueArray.length > 0){
                    return valueArray.shift()!;
                }else{
                    return new Value();
                }
            }
        }
    }
    
    private executePushAllFunction(paramValues: Array<Value>): Value | SmartPropertiesException {
        let funcParamsLength = 2;
        
        if(paramValues.length !== funcParamsLength){
            return new SmartPropertiesException(ErrorCodes.ERROR_503, [funcParamsLength, paramValues.length]);
        }else{
            let param0Array = paramValues[0];
            let param1Array = paramValues[1];
            
            if(!param0Array.isValueArray()){
                return new SmartPropertiesException(ErrorCodes.ERROR_501, [1, 'array', param0Array.getType()]);
            }else if(!param1Array.isValueArray()){
                return new SmartPropertiesException(ErrorCodes.ERROR_501, [2, 'array', param1Array.getType()]);
            }else{
                param0Array.getValueArray()!.push(...param1Array.getValueArray()!);
                return new Value();
            }
        }
    }
    
    private executePrintFunction(paramValues: Array<Value>): Value | SmartPropertiesException {
        let funcParamsMaxLength = 1;
        
        if(paramValues.length > funcParamsMaxLength){
            return new SmartPropertiesException(ErrorCodes.ERROR_503, [funcParamsMaxLength, paramValues.length]);
        }else{
            if(paramValues.length === 1){
                this.console += paramValues[0].toString();
                
            }
            this.console += '\n';
            return new Value();
        }
    }
    
    private operateNodeChildren(node: Node, variables: Record<string, Variable>): undefined | SmartPropertiesException {
        let operator: string = node.getOperator()!;
        let nodeRight: Node = node.getRight()!;
        let nodeLeft: Node = node.getLeft()!;
        let nodeChildA: Node | SmartPropertiesException = this.evaluateExpression(nodeRight, variables, this.isBooleanOperator(operator));
        
        // evaluate the right result for conditional to not evaluate left
        if(this.isBooleanOperator(operator) && nodeChildA instanceof Node && nodeChildA.isValueBoolean()){
            if(operator === '&' && !nodeChildA.getValueBoolean()){
                node.setValueBoolean(false);
                return;
            }else if(operator === '|' && nodeChildA.getValueBoolean()){
                node.setValueBoolean(true);
                return;
            }
        }
        
        let nodeChildB: Node | SmartPropertiesException = this.evaluateExpression(nodeLeft, variables, this.isBooleanOperator(operator));
        
        if(nodeChildA instanceof Node && nodeChildB instanceof Node){
            if(nodeChildA.isValueString() && nodeChildB.isValueString() && (this.isStringOperator(operator) || this.isCompareOperator(operator))){
                if(this.isCompareOperator(operator)) {
                    node.setValueBoolean(this.compareStrings(operator, nodeChildA.getValueString()!, nodeChildB.getValueString()!));
                }else{
                    node.setValueString(nodeChildA.getValueString()! + nodeChildB.getValueString()!);
                }
            } else if(((nodeChildA.isValueString() && !nodeChildB.isValueString()) || (!nodeChildA.isValueString() && nodeChildB.isValueString()))
                    && this.isStringOperator(operator)) {
                node.setValueString(nodeChildA.toString() + nodeChildB.toString());
            }else if(nodeChildA.isValueInt() && nodeChildB.isValueInt() && (this.isNumberOperator(operator) || this.isCompareOperator(operator))){
                if(this.isCompareOperator(operator)) {
                    node.setValueBoolean(this.compareInt(operator, nodeChildA.getValueInt()!, nodeChildB.getValueInt()!));
                }else {
                    node.setValueInt(this.operateInt(operator, nodeChildA.getValueInt()!, nodeChildB.getValueInt()!));
                }
            }else if(nodeChildA.isValueFloat() && nodeChildB.isValueFloat() && (this.isNumberOperator(operator) || this.isCompareOperator(operator))){
                if(this.isCompareOperator(operator)) {
                    node.setValueBoolean(this.compareFloat(operator, nodeChildA.getValueFloat()!, nodeChildB.getValueFloat()!));
                }else {
                    node.setValueFloat(this.operateFloat(operator, nodeChildA.getValueFloat()!, nodeChildB.getValueFloat()!));
                }
            }else if(nodeChildA.isValueInt() && nodeChildB.isValueFloat() && (this.isNumberOperator(operator) || this.isCompareOperator(operator))){
                if(this.isCompareOperator(operator)) {
                    node.setValueBoolean(this.compareFloat(operator, nodeChildA.getValueInt()!, nodeChildB.getValueFloat()!));
                }else {
                    node.setValueFloat(this.operateFloat(operator, nodeChildA.getValueInt()!, nodeChildB.getValueFloat()!));
                }
            }else if(nodeChildA.isValueFloat() && nodeChildB.isValueInt() && (this.isNumberOperator(operator) || this.isCompareOperator(operator))){
                if(this.isCompareOperator(operator)) {
                    node.setValueBoolean(this.compareFloat(operator, nodeChildA.getValueFloat()!, nodeChildB.getValueInt()!));
                }else {
                    node.setValueFloat(this.operateFloat(operator, nodeChildA.getValueFloat()!, nodeChildB.getValueInt()!));
                }
            }else if(nodeChildA.isValueBoolean() && nodeChildB.isValueBoolean() && (this.isBooleanOperator(operator) || this.isEqualsOperator(operator))){
                node.setValueBoolean(this.operateBoolean(operator, nodeChildA.getValueBoolean()!, nodeChildB.getValueBoolean()!));
            }else{
                return new SmartPropertiesException(ErrorCodes.ERROR_301, []);
            }          
        } else if(nodeChildA instanceof SmartPropertiesException) {
            return nodeChildA;
        } else if(nodeChildB instanceof SmartPropertiesException) {
            return nodeChildB;
        }
    }

    private isBooleanOperator(operator: string): boolean {
        return "&|!".indexOf(operator) >= 0;
    }

    private isNumberOperator(operator: string): boolean {
        return "+-*/".indexOf(operator) >= 0;
    }

    private isStringOperator(operator: string):boolean {
        return "+" === operator;
    }

    private isCompareOperator(operator: string):boolean {
        return "<=>=".indexOf(operator) >= 0;
    }

    private isEqualsOperator(operator: string):boolean {
        return "=" === operator;
    }

    private compareStrings(operator: string, a: string, b: string): boolean{
        switch (operator){
            case "=" : return a === b;
            case "<" : return a.localeCompare(b) < 0;
            case ">" : return a.localeCompare(b) > 0;
            case "<=" : return a.localeCompare(b) <= 0;
            case ">=" : return a.localeCompare(b) >= 0;
        }
        return false;
    }

    private operateInt(operator: string, a: number, b: number): number{
        switch (operator){
            case "+" : return a + b;
            case "-" : return a - b;
            case "*" : return a * b;
            case "/" : return Math.floor(a / b);
        }
        return 0;
    }

    private compareInt(operator: string, a: number, b: number): boolean{
        switch (operator){
            case "=" : return a === b;
            case "<" : return a < b;
            case ">" : return a > b;
            case "<=" : return a <= b;
            case ">=" : return a >= b;
        }
        return false;
    }

    private operateFloat(operator: string, a: number, b: number): number{
        switch (operator){
            case "+" : return a + b;
            case "-" : return a - b;
            case "*" : return a * b;
            case "/" : return a / b;
        }
        return 0.0;
    }

    private compareFloat(operator: string, a: number, b: number): boolean{
        switch (operator){
            case "=" : return a === b;
            case "<" : return a < b;
            case ">" : return a > b;
            case "<=" : return a <= b;
            case ">=" : return a >= b;
        }
        return false;
    }

    private operateBoolean(operator: string, a: boolean, b: boolean): boolean{
        switch (operator.toUpperCase()){
            case "&"  : return a && b;
            case "|"  : return a || b;
            case "!"  : return !b;
            case "="  : return a === b;
        }
        return false;
    }

    private hasChildren(node: Node): boolean{
        return node.getLeft() != null && node.getRight() != null;
    }

    public static parseBlock(blockJson: { [x: string]: any; }): Block{
        let block: Block = new Block();
        
        if(blockJson.name) block.setName(blockJson.name);
        if(blockJson.type) block.setType(blockJson.type);
        if(blockJson.condition) block.setCondition(this.parseExpression(blockJson.condition));
        if(blockJson['return']) block.setReturn(this.parseExpression(blockJson['return']));
        if(blockJson.defaultValue) block.setDefaultValue(this.parseValue(blockJson.defaultValue));

        if(blockJson.instructions){
            for(let instruction of blockJson.instructions){
                if(instruction.type === 'block'){
                    block.getInstructions()!.push(this.parseBlock(instruction));
                } else if(instruction.type === 'assignment'){
                    block.getInstructions()!.push(this.parseAssignment(instruction));
                }else if(instruction.type === 'funct'){
                    block.getInstructions()!.push(this.parseFunct(instruction));  
                }
            }
        }else{
            block.setInstructions(null);
        }
        
        return block;
    }
  
    private static parseAssignment(assignmentJson: { [x: string]: any; }): Assignment{
        let variable: Variable = new Variable(assignmentJson.variable.name);
        let assignment: Assignment = new Assignment(variable);
        
        assignment.setType(assignmentJson.type);
        assignment.setExpression(this.parseExpression(assignmentJson.expression));
        return assignment;
    }
    
    private static parseFunct(functJson: { [x: string]: any; }): Funct{
        let funct: Funct = new Funct(functJson.name);
        
        funct.setType(functJson.type);
        for(let parameter of functJson.parameters){
            funct.getParameters().push(this.parseExpression(parameter));
        }
        
        return funct;
    }
  
    private static parseExpression(nodeJson: { [x: string]: any; }): Node{
        let node: Node = new Node();
              
        this._parseValue(node, nodeJson);
        if(nodeJson.left) node.setLeft(this.parseExpression(nodeJson.left));
        if(nodeJson.right) node.setRight(this.parseExpression(nodeJson.right));
        if(nodeJson.funct) node.setFunct(this.parseFunct(nodeJson.funct));
        
        return node;
    }
    
    private static parseValue(valueJson: { [x: string]: any; }): Value{
        let value: Value = new Value();
        this._parseValue(value, valueJson);
        return value;
    }
    
    private static _parseValue(value: Value, valueJson: { [x: string]: any; }) {
        if(valueJson.variable) value.setVariable(valueJson.variable);
        if(valueJson.operator) value.setOperator(valueJson.operator);
        if(valueJson.valueString) value.setValueString(valueJson.valueString);
        if(valueJson.valueInt) value.setValueInt(valueJson.valueInt);
        if(valueJson.valueFloat) value.setValueFloat(valueJson.valueFloat);
        if(valueJson.valueBoolean) value.setValueBoolean(valueJson.valueBoolean);        
    }
  
    public getConsole(): string{
        return this.console;
    }
    
    public wasDefaultReturned(): boolean{
        return this.defaultReturned;
    }

}

export class Token {

    public static ERROR = -2;
    public static END_OF_FILE = -1;
    public static END_OF_LINE = 0;
    public static VARIABLE = 1;
    public static SYMBOL = 2;
    public static RESERVED = 3;
    public static VALUE = 4;
    public static COMMENT = 5;
    public static ASSIGN_SYMBOL = '=';
    
    private readonly value: string;
    private type: number; // -2: error, -1: end of file, 0: end of line, 1: variable, 2: symbol, 3: reserved, 4: value
    private line: number;
    private lastCharIndex: number;

    constructor(value: string, type: number, line: number, lastCharIndex: number){
        this.value = value;
        this.type = type;
        this.line = line;
        this.lastCharIndex = lastCharIndex;
    }

    public getValue(): string {
        return this.value;
    }

    public setType(type: number): void {
        this.type = type;
    }

    public getType(): number {
        return this.type;
    }

    public getLine(): number {
        return this.line;
    }

    public setLine(line: number): void {
        this.line = line;
    }

    public getLastCharIndex(): number {
        return this.lastCharIndex;
    }

    public isVariable(){
        return this.getType() === Token.VARIABLE;
    }

    public isNotVariable(){
        return !this.isVariable();
    }

    public isValue(){
        return this.getType() === Token.VALUE;
    }

    public isNotValue(){
        return !this.isValue();
    }

    public isReserved(){
        return this.getType() === Token.RESERVED;
    }

    public isNotReserved(){
        return !this.isReserved();
    }

    public isError(){
        return this.getType() === Token.ERROR;
    }

    public isNotError(){
        return !this.isError();
    }

    public isEndOfLine(){
        return this.getType() === Token.END_OF_LINE;
    }

    public isNotEndOfLine(){
        return !this.isEndOfLine();
    }

    public isEndOfFile(){
        return this.getType() === Token.END_OF_FILE;
    }

    public isNotEndOfFile(){
        return !this.isEndOfFile();
    }

    public isComment(){
        return this.getType() === Token.COMMENT;
    }

    public isNotComment(){
        return !this.isComment();
    }

    public isAssignedSymbol(){
        return this.getValue() === Token.ASSIGN_SYMBOL;
    }

    public isNotAssignedSymbol(){
        return !this.isAssignedSymbol();
    }

    public isString(){
        return this.getValue().indexOf('"') === 0;
    }

    public isNotString(){
        return !this.isString();
    }

    public isOperator(){
        return this.getValue() === '+' || this.getValue() === '-' || this.getValue() === '*' || this.getValue() === '/';
    }

    public isNotOperator(){
        return !this.isOperator();
    }

    public isSign(){
        return this.getValue() === '+' || this.getValue() === '-';
    }

    public isConditionalOperator(){
        return this.getValue() === '>' || this.getValue() === '<' || this.getValue() === '>=' || this.getValue() === '<=' || this.getValue() === '=';
    }

    public isNotConditionalOperator(){
        return !this.isConditionalOperator();
    }

    public isLogicalOperator(){
        return SmartPropertiesUtils.equals(this, SmartPropertiesWords.LOG_OP_AND) || SmartPropertiesUtils.equals(this, SmartPropertiesWords.LOG_OP_OR);
    }

    public isNotLogicalOperator(){
        return !this.isLogicalOperator();
    }

    public isLogicalAndOperator(){
        return SmartPropertiesUtils.equals(this, SmartPropertiesWords.LOG_OP_AND);
    }

    public isLogicalOrOperator(){
        return SmartPropertiesUtils.equals(this, SmartPropertiesWords.LOG_OP_OR);
    }

    public isLogicalNotOperator(){
        return SmartPropertiesUtils.equals(this, SmartPropertiesWords.LOG_OP_NOT);
    }

    public isBooleanTrue(){
        return SmartPropertiesUtils.equals(this, SmartPropertiesWords.BOOL_TRUE);
    }

    public isBooleanFalse(){
        return SmartPropertiesUtils.equals(this, SmartPropertiesWords.BOOL_FALSE);
    }

    public isOperatorAll(){
        return this.isOperator() || this.isConditionalOperator() || this.isLogicalOperator() || this.isLogicalNotOperator();
    }

    public isOpenParenthesis(){
        return this.getValue() === '(';
    }

    public isNotOpenParenthesis(){
        return !this.isOpenParenthesis();
    }

    public isComma(){
        return this.getValue() === ',';
    }

    public isNotComma(){
        return !this.isComma();
    }

    public isCloseParenthesis(){
        return this.getValue() === ')';
    }

    public isNotCloseParenthesis(){
        return !this.isCloseParenthesis();
    }

    public isNumber(){
        return !isNaN(Number(this.getValue()));
    }

    public getTypeName(): string{
        switch(this.getType()){
            case Token.ERROR: return 'error';
            case Token.END_OF_FILE: return 'endOfFile';
            case Token.END_OF_LINE: return 'endOfLine';
            case Token.VARIABLE: return 'variable';
            case Token.SYMBOL: return 'symbol';
            case Token.RESERVED: return 'reserved';
            case Token.VALUE: return 'value';
            case Token.COMMENT: return 'comment';
        }      
        return '';
    }

}

class Instruction {

    private type : string | null;

    constructor(){
        this.type = '';
    }

    public setType(type: string | null){
        this.type = type;
    }

    public getType(): string | null{
        return this.type;
    }

}

export class Block extends Instruction{

    private name: string | null;
    private condition: Node | null;
    private conditionResult: boolean | null;
    private instructions: Array<Assignment | Funct | Block> | null;
    private 'return' : Node | null;
    private defaultValue: Value | null;

    constructor(){
        super();
        this.name = null;
        this.instructions = [];
        this['return'] = null;
        this.condition = null;
        this.setType('block');
        this.conditionResult = null;
        this.defaultValue = null;
    }

    public setName(name: string | null){
        this.name = name;
    }

    public getName(): string | null {
        return this.name;
    }

    public setCondition(condition: Node){
        this.condition = condition;
    }

    public getCondition(): Node | null{
        return this.condition;
    }

    public getConditionResult() : boolean | null{
        return this.conditionResult;
    }
  
    public setConditionResult(conditionResult: boolean) {
        this.conditionResult = conditionResult;
    }
    
    public setInstructions(instructions: Array<Assignment | Funct | Block> | null) {
        this.instructions = instructions;
    }

    public getInstructions(): Array<Assignment | Funct | Block> | null{
        return this.instructions;
    }

    public setReturn(returnP: Node){
        this['return'] = returnP;
    }

    public getReturn(): Node | null{
        return this['return'];
    }

    public getDefaultValue() : Value | null{
        return this.defaultValue;
    }

    public setDefaultValue(value: Value){
        this.defaultValue = value;
    }

}

export class Assignment extends Instruction{

    private variable : Variable;
    private expression! : Node;

    constructor(variable: Variable){
        super();
        this.variable = variable;
        this.setType('assignment');
    }

    public setVariable(variable: Variable){
        this.variable = variable;
    }

    public getVariable(): Variable{
        return this.variable;
    }

    public setExpression(expression: Node){
        this.expression = expression;
    }

    public getExpression(): Node{
        return this.expression;
    }

}

export class Funct extends Instruction{
  
    private name : string;
    private parameters : Array<Node>;
    
    constructor(name : string){
        super();
        this.name = name;
        this.parameters = [];
        this.setType('funct');
    }
    
    public setName(name: string){
      return this.name = name;
    }
    
    public getName(): string{
      return this.name;
    }
    
    public getParameters(){
      return this.parameters;
    }
  
}

export class Value {

    private variable: string | null;
    private operator: string | null;
    private valueString: string | null;
    private valueInt: number | null;
    private valueFloat: number | null;
    private valueBoolean: boolean | null;
    private valueArray: Array<Value> | null;
    
    private boolInitialized: boolean;
    private boolVariable: boolean;
    private boolOperator: boolean;
    private boolValueString: boolean;
    private boolValueInt: boolean;
    private boolValueFloat: boolean;
    private boolValueBoolean: boolean;
    private boolValueArray: boolean;

    constructor(){
        this.variable = null;
        this.operator = null;
        this.valueString = null;
        this.valueInt = null;
        this.valueFloat = null;
        this.valueBoolean = null;
        this.valueArray = null;
        
        this.boolInitialized = false;
        this.boolVariable = false;
        this.boolOperator = false;
        this.boolValueString = false;
        this.boolValueInt = false;
        this.boolValueFloat = false;
        this.boolValueBoolean = false;
        this.boolValueArray = false;
    }
    
    public setValue(value: Value){
        if(value.isValueString()){
            this.setValueString(value.getValueString()!);
        }else if(value.isValueInt()){
            this.setValueInt(value.getValueInt()!);
        }else if(value.isValueFloat()){
            this.setValueFloat(value.getValueFloat()!);
        }else if(value.isValueBoolean()){
            this.setValueBoolean(value.getValueBoolean()!);
        }else if(value.isValueArray()){
            this.setValueArray(value.getValueArray()!);
        }
    }

    public getVariable(): string | null {
        return this.variable;
    }

    public setVariable(variable: string) {
        this.variable = variable;
        this.boolVariable = true;
    }

    public getOperator(): string | null {
        return this.operator;
    }

    public setOperator(operator: string) {
        this.operator = operator;
        this.boolOperator = true;
    }

    public getValueString(): string | null {
        return this.valueString;
    }

    public setValueString(valueString : string) {
        this.valueString = valueString;
        this.boolInitialized = true;
        this.boolValueString = true;
        
        this.valueInt = null;
        this.valueFloat = null;
        this.valueBoolean = null;
        this.valueArray = null;
        
        this.boolValueInt = false;
        this.boolValueFloat = false;
        this.boolValueBoolean = false;
        this.boolValueArray = false;
    }

    public getValueInt(): number | null {
        return this.valueInt;
    }

    public setValueInt(valueInt: number) {
        this.valueInt = valueInt;
        this.boolInitialized = true;
        this.boolValueInt = true;
        
        this.valueString = null;
        this.valueFloat = null;
        this.valueBoolean = null;
        this.valueArray = null;
        
        this.boolValueString = false;
        this.boolValueFloat = false;
        this.boolValueBoolean = false;
        this.boolValueArray = false;
    }

    public getValueFloat(): number | null {
        return this.valueFloat;
    }

    public setValueFloat(valueFloat: number) {
        this.valueFloat = valueFloat;
        this.boolInitialized = true;
        this.boolValueFloat = true;
        
        this.valueString = null;
        this.valueInt = null;
        this.valueBoolean = null;
        this.valueArray = null;
        
        this.boolValueString = false;
        this.boolValueInt = false;
        this.boolValueBoolean = false;
        this.boolValueArray = false;
    }

    public getValueBoolean(): boolean | null {
        return this.valueBoolean;
    }

    public setValueBoolean(valueBoolean: boolean) {
        this.valueBoolean = valueBoolean;
        this.boolInitialized = true;
        this.boolValueBoolean = true;
        
        this.valueString = null;
        this.valueInt = null;
        this.valueFloat = null;
        this.valueArray = null;
        
        this.boolValueString = false;
        this.boolValueInt = false;
        this.boolValueFloat = false;
        this.boolValueArray = false;
    }
    
    public getValueArray(): Array<Value> | null {
        return this.valueArray;
    }
    
    public setValueArray(valueArray: Array<Value>) {
        this.valueArray = valueArray;
        this.boolInitialized = true;
        this.boolValueArray = true;
        
        this.valueString = null;
        this.valueInt = null;
        this.valueFloat = null;
        this.valueBoolean = null;
        
        this.boolValueString = false;
        this.boolValueInt = false;
        this.boolValueFloat = false;
        this.boolValueBoolean = false;
    }

    public isInitialized(): boolean {
        return this.boolInitialized;
    }

    public isVariable(): boolean {
        return this.boolVariable;
    }

    public isOperator(): boolean {
        return this.boolOperator;
    }

    public isValueString(): boolean {
        return this.boolValueString;
    }

    public isValueInt(): boolean {
        return this.boolValueInt;
    }

    public isValueFloat(): boolean {
        return this.boolValueFloat;
    }

    public isValueBoolean(): boolean {
        return this.boolValueBoolean;
    }

    public isValueArray(): boolean {
        return this.boolValueArray;
    }

    public toString(): string{
        if (this.boolValueBoolean){
            return this.valueBoolean + '';
        } else if (this.boolValueInt){
            return this.valueInt + '';
        } else if (this.boolValueFloat) {
            return this.valueFloat + '';
        } else if (this.boolValueString) {
            return this.valueString + '';
        } else if (this.boolValueArray) {
            return this.valueArray + '';
        }
        return '';
    }

    public getType(): string{
        if (this.boolValueBoolean){
            return 'boolean';
        } else if (this.boolValueInt){
            return 'int';
        } else if (this.boolValueFloat) {
            return 'float';
        } else if (this.boolValueString) {
            return 'string';
        } else if (this.boolValueArray) {
            return 'array';
        }
        return '';
    }

}

export class Node extends Value{
  
    private left: Node | null;
    private right: Node | null;
    private funct: Funct | null;

    constructor(){
    super();
        this.left = null;
        this.right = null;
        this.funct = null;
    }

    public getLeft(): Node | null{
        return this.left;
    }

    public setLeft(left: Node){
        this.left = left;
    }

    public getRight(): Node | null{
        return this.right;
    }

    public setRight(right: Node){
        this.right = right;
    }
    
    public setFunct(funct: Funct){
        this.funct = funct;
    }
  
    public getFunct(): Funct | null {
        return this.funct;
    }
    
    public isFunction(){
        return this.funct != null;
    }

}

export class Variable extends Value{

    private name: string;

    constructor(name: string){
    super();
        this.name = name;
    }

    public setName(name: string){
        this.name = name;
    }

    public getName(): string{
        return this.name;
    }

}

export class SmartPropertiesException {
  
    private message: string;
    
    constructor(message: string, args: Array<string | boolean | number>){
        this.message = message.replace(/{(\d+)}/g, function(match: string, number: string) {
            return '' + (typeof args[parseInt(number)] != 'undefined' ? args[parseInt(number)] : match)
        });
        console.error(this.message);
    }
  
    public setMessage(message: string){
        this.message = message;
    }

    public getMessage(): string{
        return this.message;
    }

}