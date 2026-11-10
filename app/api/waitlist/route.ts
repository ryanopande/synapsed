import { LoopsClient } from "loops";

const loops = new LoopsClient(process.env.LOOPS_API_KEY as string);

export async function POST(request: Request) {

try {

    
    const res = await request.json();

    const email = res["email"];

    const response = await loops.findContact({email: email});

    //console.log(`The findContact response is: ${response}`)

    if (response.length != 0){

        return Response.json({message: "User already exists"})
    }

    // Note: updateContact() will create or update a contact
    const resp: {
        success: boolean,
        id?: string,
        message?: string
    } = await loops.createContact(email); //create a contact

    return Response.json({ success: resp.success });

} catch (error) {
    console.error(`An error occured while sending the email to the server: ${error}`);
    return Response.json({ success: false });
}
  
}
