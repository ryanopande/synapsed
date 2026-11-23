import json
OPT = {
 "goals_2": ["Required for my major","Personal interest in the subject","Career advancement","Prerequisite for other courses","Other"],
 "prereq_1": ["Very confident","Somewhat confident","Neutral","Somewhat uncertain","Very uncertain"],
 "learning_1": ["Visual (diagrams, charts, videos)","Auditory (lectures, discussions)","Reading/Writing (texts, notes)","Kinesthetic (hands-on activities)","Mixed approach"],
}
KEYS = ["goals_1","goals_2","prereq_1","learning_1","bloom_remember","bloom_understand","bloom_apply","bloom_analyze"]
V="Visual (diagrams, charts, videos)"; A="Auditory (lectures, discussions)"; R="Reading/Writing (texts, notes)"; K="Kinesthetic (hands-on activities)"; M="Mixed approach"

def p(id_, role, desc, g1,g2,pr,ls,rem,und,app,ana):
    return {"id":id_,"_role":role,"description":desc,"answers":dict(zip(KEYS,[g1,g2,pr,ls,rem,und,app,ana]))}

profiles = [
 # practice
 p("amal_r","practice","Economics, 3rd year. Used only for the walkthrough.",
   "I want to understand how AI is changing jobs and productivity, since that is close to what I study in labour economics.",
   "Career advancement","Somewhat uncertain",M,
   "Intro stats and econometrics (regression). I use ChatGPT sometimes to summarise readings.",
   "What machine learning actually is, and what generative AI can and cannot do.",
   "For my thesis on automation and wages, and later in a policy or consulting job.",
   "Keeping up with the technical words. I am not a programmer."),
 # core cases
 p("lina_m","case","Nursing BSN, 3rd year. No computing background.",
   "Learn how to use AI tools safely at work. Our hospital placement started using an AI note-writing tool and I want to know when I can trust it and how it affects patient safety and privacy.",
   "Required for my major","Very uncertain",V,
   "I have not taken any computer science or AI course. Only one intro statistics class. Tried ChatGPT twice for essay outlines.",
   "Basic terms like machine learning and generative AI, why AI makes mistakes, and how to check its output.",
   "Checking AI-written clinical notes before I sign them, and explaining to patients when AI was involved.",
   "The technical vocabulary. I worry I will be the slowest in the class."),
 p("omar_k","case","MPH (public health) master's student, part-time data analyst at a health NGO.",
   "Two things: (1) build a small chatbot that answers staff questions from our NGO's health guidelines (I read about RAG), and (2) put together a short plan to convince my manager to adopt AI responsibly without harming the communities we serve.",
   "Career advancement","Somewhat confident",K,
   "Epidemiology and biostatistics, some R. I use ChatGPT weekly for drafting reports. Never trained a model myself.",
   "How retrieval-based chatbots work, how organisations roll out AI, and the equity risks in health settings.",
   "A pilot chatbot for field staff and a one-page adoption proposal for my manager.",
   "Time. I work 20 hours a week, so realistically about 4 hours a week for this course."),
 p("daniel_w","case","Finance, final year. Rates himself very confident.",
   "Get better at prompting so I can automate parts of my financial modelling. I'd like to skip the basics, I already know how AI works.",
   "Career advancement","Very confident",R,
   "I use ChatGPT every day for work and watched a YouTube series on neural networks. Machine learning is basically the computer writing lots of if-then rules really fast. The more data you give a model the more accurate it gets, so bias is not really an issue if the dataset is big enough.",
   "Advanced prompt techniques and how to plug AI into Excel and my workflows.",
   "Automating forecasts and investment memos at my internship.",
   "Honestly not many. Maybe the ethics part, not sure it is relevant to finance."),
 # fairness pair (identical except learning style)
 p("mei_t","pair","Education (primary teaching), 2nd year. Pair with sara_b: identical except learning style.",
   "Understand generative AI well enough to decide how my future pupils should and should not use it.",
   "Personal interest in the subject","Neutral",V,
   "No AI courses. I use ChatGPT occasionally to plan lessons.",
   "How tools like ChatGPT produce answers, how to write good prompts, and the risks for children.",
   "Designing classroom activities and an AI-use policy for my placement school.",
   "Telling apart what is hype and what is real."),
 p("sara_b","pair","Education (primary teaching), 2nd year. Pair with mei_t: identical except learning style.",
   "Understand generative AI well enough to decide how my future pupils should and should not use it.",
   "Personal interest in the subject","Neutral",R,
   "No AI courses. I use ChatGPT occasionally to plan lessons.",
   "How tools like ChatGPT produce answers, how to write good prompts, and the risks for children.",
   "Designing classroom activities and an AI-use policy for my placement school.",
   "Telling apart what is hype and what is real."),
 # class fillers
 p("jonas_e","filler","Computer Science, 4th year, ML coursework, research assistant.",
   "Go deeper on generative AI for research: retrieval-augmented generation, fine-tuning trade-offs, evaluation.",
   "Personal interest in the subject","Very confident",K,
   "Machine learning, deep learning (PyTorch), gradient descent, transformers at a high level. Built a small classifier for a course project.",
   "Practical workflows for building LLM applications and where they fail.",
   "My research project on question answering over lab documents.",
   "The non-technical parts like business strategy may feel slow for me."),
 p("priya_s","filler","MBA, previously product manager.",
   "Learn how to lead AI adoption in a team: picking projects, strategy, and change management.",
   "Career advancement","Somewhat uncertain",A,
   "No technical courses. I have managed vendors who sold 'AI features'.",
   "What makes a good AI project and how companies transform with AI.",
   "Running an AI pilot when I go back to industry.",
   "Judging technical claims from engineers and vendors."),
 p("hugo_l","filler","History BA, 2nd year.",
   "understand what ai is and how it might change historical research and archives",
   "Required for my major","Very uncertain",A,
   "none, never used any ai tools except google translate",
   "the basics, what it can and cant do",
   "maybe searching archives or transcribing old documents",
   "everything technical honestly"),
 p("fatima_a","filler","Journalism MA.",
   "Understand misinformation, deepfakes and bias in generative AI so I can report on it responsibly.",
   "Career advancement","Somewhat uncertain",R,
   "No technical background. I have fact-checked AI-generated images for a student newspaper.",
   "How generative models make text and images, and the main ethical debates.",
   "Verification work and explaining AI stories to readers.",
   "Understanding the technical side well enough not to make errors in articles."),
 p("kenji_n","filler","Statistics, 3rd year.",
   "Connect what I know from statistics to generative AI and learn structured prompting (few-shot, chain-of-thought).",
   "Prerequisite for other courses","Somewhat confident",M,
   "Regression, classification, cross-validation, a bit of Python. Haven't studied neural networks.",
   "How LLMs differ from the statistical models I know, and prompt templates.",
   "Data analysis assistants for my coursework.",
   "Not sure how much of the course will be too basic vs too new."),
 p("rosa_g","filler","Political Science, 3rd year.",
   "Understand AI well enough to write about AI regulation and its impact on jobs and elections.",
   "Personal interest in the subject","Neutral",M,
   "No AI courses. Use ChatGPT to brainstorm essay ideas.",
   "What AI can do today, and the societal risks.",
   "A policy paper on AI and labour markets.",
   "Technical terms."),
]

for pr in profiles:
    a=pr["answers"]
    for k in KEYS: assert a[k].strip(), (pr["id"],k)
    for k,opts in OPT.items(): assert a[k] in opts, (pr["id"],k,a[k])
assert len({x["id"] for x in profiles})==len(profiles)
# pair check
m={x["id"]:x["answers"] for x in profiles}
diff=[k for k in KEYS if m["mei_t"][k]!=m["sara_b"][k]]; assert diff==["learning_1"], diff

seed = {"version":"study1-v1","course":"AI Literacy — Foundations, Generative AI & Prompting (study/data/syllabus/syllabus.json)",
        "note":"Researcher-authored simulated learners for SynapsEd Study 1. Fictional people. Do not show the 'description' or the scenario key to participants.",
        "profiles":[{k:v for k,v in x.items() if not k.startswith('_')} for x in profiles]}
json.dump(seed, open("study1_profiles.json","w"), indent=2, ensure_ascii=False)
print(len(profiles), "profiles ok")
