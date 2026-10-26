import z, { ZodError } from "zod";
import type { Request, Response, NextFunction } from "express"

const bodyValidator = (schema: z.ZodType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
       const data = req.body; 
       // validation starts
        if(!data) {
          next({code: 422, message: "Data empty/not set"})
          return;
        } 

        await schema.parseAsync(data)
        next()
    } catch(exception) {
      let detail: Record<string, string> = {}
      let message = "Validation failed"
      if(exception instanceof ZodError) {
        const messages: string[] = []
        exception.issues.map((errObj: any) => {
          detail[errObj.path.join(".")] = errObj.message
          messages.push(errObj.message)
        })
        if (messages.length === 1) message = messages[0]
        else if (messages.length > 1) message = messages.join(" | ")
      }
      next({code: 400, message, details: detail})
    }
  }
}

export default bodyValidator;
