import { LoopsClient } from "loops";

// Public endpoint: adds a landing-page visitor to the Loops waitlist.
const loops = new LoopsClient(process.env.LOOPS_API_KEY as string);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST { email, name?, status? }: add a contact to the waitlist
export async function POST(request: Request) {
  try {
    const { email, name, status } = await request.json();

    if (typeof email !== "string" || !EMAIL.test(email)) {
      return Response.json({ success: false, message: "A valid email is required" }, { status: 400 });
    }

    const existing = await loops.findContact({ email });
    if (existing.length != 0) {
      return Response.json({ success: true, message: "User already exists" });
    }

    const properties: Record<string, string> = {};
    if (typeof name === "string" && name.trim()) properties.firstName = name.trim();
    if (typeof status === "string" && status) properties.userGroup = status;

    const resp = await loops.createContact(email, properties);
    return Response.json({ success: resp.success }, { status: resp.success ? 200 : 502 });
  } catch (error) {
    console.error(`An error occured while sending the email to the server: ${error}`);
    return Response.json({ success: false }, { status: 500 });
  }
}
