
export class SmartPropertiesWords{

    public static IC_IF = ['IF', 'SI'];
    public static IC_THEN = ['THEN', 'ENTONCES'];
    public static IC_ELSE = ['ELSE', 'SINO'];
    public static IC_WHILE = ['WHILE', 'MIENTRAS'];
    public static IC_END = ['END', 'FIN'];
    public static IC_RETURN = ['RETURN', 'RETORNAR'];

    public static LOG_OP_AND = ['AND', 'Y'];
    public static LOG_OP_OR = ['OR', 'O'];
    public static LOG_OP_NOT = ['NOT', 'NO'];
    
    public static BOOL_TRUE = ['TRUE', 'VERDADERO'];
    public static BOOL_FALSE = ['FALSE', 'FALSO'];

    public static FUNCTION_CALL = ["CALL", "LLAMAR"];
    public static FUNCTION_SQRT = ["SQRT", "SQUAREROOT", "RAIZCUADRADA"];
    public static FUNCTION_ARRAY = ["ARRAY", "ARREGLO"];
    public static FUNCTION_GET = ["GET", "OBTENER"];
    public static FUNCTION_SIZE = ["LENGTH", "LONGITUD"];
    public static FUNCTION_PUSH = ["PUSH", "PONER"];
    public static FUNCTION_POP = ["POP", "SACAR"];
    public static FUNCTION_UNSHIFT = ["UNSHIFT", "PONERPRIMERO"];
    public static FUNCTION_SHIFT = ["SHIFT", "SACARPRIMERO"];
    public static FUNCTION_PUSH_ALL = ["PUSHALL", "PONERTODO"];
    public static FUNCTION_PRINT = ["PRINT", "PINTAR"];
    
    public static FUNCTIONS = [ SmartPropertiesWords.FUNCTION_CALL, 
                                SmartPropertiesWords.FUNCTION_SQRT, 
                                SmartPropertiesWords.FUNCTION_ARRAY,
                                SmartPropertiesWords.FUNCTION_GET,
                                SmartPropertiesWords.FUNCTION_SIZE,
                                SmartPropertiesWords.FUNCTION_PUSH,
                                SmartPropertiesWords.FUNCTION_POP,
                                SmartPropertiesWords.FUNCTION_SHIFT,
                                SmartPropertiesWords.FUNCTION_UNSHIFT,
                                SmartPropertiesWords.FUNCTION_PUSH_ALL,
                                SmartPropertiesWords.FUNCTION_PRINT ];

} 