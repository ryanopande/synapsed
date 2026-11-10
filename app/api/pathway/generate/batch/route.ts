import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type SurveyAnswer = { questionId: string; answer: string };
type SurveyQuestion = { id: string; text: string };

export async function POST(req: Request) {
  const { classId } = await req.json();
  if (!classId) return NextResponse.json({ error: "Missing classId" }, { status: 400 });

  // Get real syllabus content for this class
  let syllabusContent = "";
  let learningObjectives = "";
  let assessmentMethods = "";
  let prerequisites = "";
  let courseDescription = "";
  
  try {
    const syllabusResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/syllabus/content?classId=${classId}`);
    if (syllabusResponse.ok) {
      const syllabusData = await syllabusResponse.json();
      if (syllabusData.hasSyllabus) {
        syllabusContent = syllabusData.content.courseSchedule || "";
        learningObjectives = syllabusData.content.learningObjectives || "";
        assessmentMethods = syllabusData.content.assessmentMethods || "";
        prerequisites = syllabusData.content.prerequisites || "";
        courseDescription = syllabusData.content.courseDescription || "";
        console.log(`📚 Using real syllabus content (confidence: ${syllabusData.content.averageConfidence}%)`);
      }
    }
  } catch (error) {
    console.error("Failed to fetch syllabus content:", error);
  }

  // Fallback to dummy data if no real syllabus is available
  if (!syllabusContent && !learningObjectives) {
    console.log("No syllabus content found, using fallback data for probability and statistics");
    syllabusContent = `
Course Schedule: Tentative breakdown of course topics with corresponding sections
of the required textbook and numbers of the recorded lectures (L)
Day Date Reading Topics
Wed Jan 22 2.4
L 1
Sample Spaces, Events,
Probability Measures
Mon Jan 27 2.6
L 2
Counting Methods for
Computing Probabilities
Wed Jan 29 2.7, 2.8, 2.10
L 3
Conditional Probabilities
Mon Feb 3 2.7
L 4
Independence
Wed Feb 5 3.1, 3.2
L 5, 6
Discrete Random Variables
Probability Distribution, Mass Function, Cumulative
Distribution Function (CDF)
Mon Feb 10 3.3
L 7, 8
Functions of Discrete Random variables
Expectation and Variance for Discrete Random
Variables
Wed Feb 12 3.4, 3.5, 3.8
L 9
Examples of Discrete Random Variables
Mon Feb 17 4.1-4.6
L 10
Continuous Random Variables
Expectation of Continuous Random Variables
Examples of Density Functions
Wed Feb 19 5.1, 5.2, 5.4
L 11, 12
Joint Distributions for Discrete Random Variables
Independence of Discrete Random Variables
Mon Feb 24 5.3, 5.8, 5.11
L 13
Conditional Distributions and Expectations for
Discrete Random Variables
Wed Feb 26 5.2, 5.3
L 14
Joint and Marginal Distributions for Continuous
Random Variables
Mon Mar 3 5.3, 5.4, 5.5
L 15, 16
Independence of Continuous Random Variables
Conditional Density Functions
Wed Mar 5 Review
Mon Mar 10 Midterm
Mon Mar 17 L 17 Exponential Distribution and Poisson Processes
MATH-UH 2011Q 6
Wed Mar 19 4.3, 4.10, 3.11
L 18
Expectation and Variance for Continuous Random
Variables
Mon Mar 24 5.7
L 19
Covariance and Correlation
Wed Mar 26 L 20 The Law of Large Numbers
Mon Apr 7 7.3
L 21
The Central Limit Theorem
Wed Apr 9 8.1, 8.2
L 22
Survey Sampling
Mon Apr 14 8.3
L 23
Estimation of the Population Variance
Wed Apr 16 9.6, 7.2
L 24
Estimation of Parameters
Mon Apr 21 9.7
L 25
The Method of Maximum Likelihood
Wed Apr 23 8.5-8.7, 7.2
L 26
Confidence Intervals
Mon Apr 28 10.1-10.8
L 27
Hypothesis Testing
Wed Apr 30 11.1-11.4
L28
Simple Linear Regression and the Least Squares
Method
Mon May 5 11.8 Correlation
Wed May 7 Review
`;

    learningObjectives = `
Course Description
Most real-world phenomena include non-deterministic or non-deterministically predictable
features. The course is designed to provide an introduction to the mathematical treatment
of such aspects, acquainting the students with both probability and statistics. The course
includes: mathematical definition of probability; combinatorics; finite, discrete and
continuous probabilities of single and joint random variables; law of large numbers and
normal approximation; sampling; estimation; testing of hypotheses; correlation and
regression.
Course Learning Outcomes (CLOs) and Links to Program Learning Outcomes (PLOs)
Teaching and Learning Methodologies
● The course tries to serve several complementary needs.
1. It is a basic introduction, but with some more advanced topics.
2. The emphasis is on solving exercises, but with some attention to the deductive
structure of the theory with the related proofs.
3. It develops the basic elements of statistics, but with their probabilistic
background.
● The class meets for lectures twice a week and for recitations once a week. You are
expected to study outside of class, up to four hours for each day of class. Studying
can be reading the book, reviewing notes, practicing problems, or doing homework.
● Homework is assigned every week, using the WebAssign platform, and needs to be
completed by the first class of the following week.
Upon successful completion of this
course the student will be able to:
MATH
PLO1
MATH
PLO2
MATH
PLO3
MATH
PLO4
CLO1: Use elementary tools from
Descriptive Statistics Low Low
CLO2: Compute probabilities and
operate with random variables with
finite, discrete and continuous
distributions
High High Low
CLO3: Apply various techniques of
statistical point and interval
estimation, test of hypothesis, and
regression
High Low Med
CLO4: Apply various techniques of
Bayesian Statistics Low High High
`;
  }

  // Get all student survey responses for this class
  const responses = await prisma.studentSurveyResponse.findMany({ where: { classId } });
  const survey = await prisma.survey.findFirst({ 
    where: { classId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }
  });
  const questions = Array.isArray(survey?.questions) ? survey.questions : [];

  for (const response of responses) {
    // Build comprehensive prompt from real syllabus content and student responses
    const prompt =
      `Course Description:\n${courseDescription}\n\n` +
      `Prerequisites:\n${prerequisites}\n\n` +
      `Learning Objectives:\n${learningObjectives}\n\n` +
      `Course Schedule:\n${syllabusContent}\n\n` +
      `Assessment Methods:\n${assessmentMethods}\n\n` +
      `Student Survey Responses:\n` +
      (response.answers as SurveyAnswer[]).map((ans) => {
        const q = (questions as SurveyQuestion[]).find((q) => q.id == ans.questionId);
        return `Q: ${q?.text || "Unknown"}\nA: ${ans.answer}`;
      }).join("\n") +
      `\n\nBased on the comprehensive course information above and the student's survey responses, generate a personalized learning pathway that:
      1. Aligns with the course learning objectives and schedule
      2. Considers the student's learning preferences and interests
      3. Takes into account any prerequisites or background knowledge
      4. Incorporates the assessment methods and grading structure
      5. Provides a structured progression through the course material
      
      Create 12-15 pathway nodes that are modular, well-connected, and personalized to this student's needs.`;

    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/pathway/generate?studentId=${response.studentId}&classId=${classId}&prompt=${encodeURIComponent(prompt)}`);
  }

  return NextResponse.json({ success: true });
}