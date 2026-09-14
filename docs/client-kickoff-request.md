# Kickoff email to the client

Send on Day 1. Replace the placeholders in angle brackets. Attach nothing; every link is in the text.

---

Subject: Phone assistant project: 8 things we need from you to start

Hi <office manager name>,

Thank you for choosing us to build the phone assistant. To get started we need eight things from your side. The first three are accounts that only the practice can create, because the practice must be the legal owner of anything that touches patient information. We cannot start building until items 1 to 4 are done, so please do those first. Items 5 to 8 can follow over the next few days.

If anything below is unclear, reply to this email or call me at <our phone>. Each item should take 10 to 20 minutes.

1. Retell account (the voice service)

Why: Retell is the company whose system answers the phone. It will hear patient names and appointment details, so the practice must have a signed Business Associate Agreement (BAA) with them. That agreement is free and takes a few minutes.

How:
a. Go to https://retellai.com and create an account using a practice email address, not a personal one. Choose the pay-as-you-go plan.
b. Turn on two-factor authentication in your account settings (it will ask for a phone or an authenticator app).
c. Sign the BAA. In the Retell dashboard go to Settings, then look for Compliance or Agreements, and click through to sign the HIPAA BAA. Download the signed copy and email it to us.
d. Add us as an admin: Settings, Members, invite bytesuite@bytesplatform.com with the Admin role. We will remove ourselves when the project is handed over.

2. Amazon Web Services account (where the automation runs)

Why: the part of the system that talks to your scheduling software runs on a small server. It has to run on the practice's own AWS account, under AWS's HIPAA agreement, so that the practice always owns and controls it.

How:
a. Go to https://aws.amazon.com and create an account with a practice email and a credit card. Turn on two-factor authentication for the main login (AWS calls it MFA).
b. Accept the HIPAA agreement: in the AWS console search for "Artifact", open it, click Agreements, then Account agreements, find "AWS Business Associate Addendum", read it, and click Accept. Take a screenshot of the page showing it as Active and send it to us.
c. Create a login for us: search for "IAM", click Users, Create user, name it bytes-contractor, no console access, attach the policies AmazonEC2FullAccess, AmazonRDSFullAccess and AmazonVPCFullAccess. Then open the user, Security credentials, Create access key, choose Command Line Interface, download the file, and share it with us through a password manager link (not by email). We will send you a secure link to use.

3. NexHealth developer account (the link to Dentrix)

Why: Dentrix has no affordable way for outside software to book appointments directly. NexHealth is a service that connects to Dentrix and lets our system read openings and write bookings, and it comes with its own BAA. The first 10,000 requests per month are free.

How:
a. Go to https://developers.nexhealth.com/signup and create an account with a practice email.
b. Sign the BAA when prompted during setup (or under Settings, Agreements). Send us the signed copy.
c. Invite bytesuite@bytesplatform.com as a developer on the account.
d. Important: NexHealth works by installing a small program on the computer that runs your Dentrix server. Please check with whoever looks after that computer (your IT person) that they are willing to install it. Let us know their name and whether they agree. If they do not, we can still launch, but bookings will go to a queue for your staff to enter instead of straight into Dentrix.

4. Details about your Dentrix setup

Why: the assistant has to offer the right appointment types, the right lengths, and the right providers and chairs at each location, exactly as Dentrix expects them. Getting this from you up front means we build it once.

How: reply with a list, or a photo of the relevant Dentrix screens, covering:
a. Dentrix version (Help, About in Dentrix) and the Windows version of the server.
b. Each provider's name and which location(s) they work at.
c. The appointment types you want the assistant to book (for example cleaning, exam, emergency) and how long each takes.
d. The names of the operatories (chairs) at each location as they appear in Dentrix.

5. Office facts for the assistant's knowledge

Why: the assistant answers questions like "are you open Saturday" and "do you take Delta Dental" from documents you give us. These documents must contain office facts only, and never a patient name, so that nothing private can be repeated to a caller.

How: for each location, write or paste into a shared Google Drive folder (we will send you the folder link):
a. Hours, address, parking, what to bring to a first visit.
b. Insurance plans you accept and a short note on how you handle plans you do not accept.
c. Typical fee ranges you are comfortable stating over the phone (or "we do not quote fees by phone").
d. Policies: cancellation, late arrival, new patient paperwork, children, emergencies.
e. The 30 questions your front desk hears most, with the answer you would give.
Please double-check nothing in these files mentions an individual patient.

6. Phone numbers

Why: the assistant needs a number to answer at each location. We can either move your existing numbers to the new system (porting, takes 1 to 2 weeks) or leave them where they are and forward calls to new numbers we set up (takes a day). Either works; forwarding is simpler to start with.

How: reply with the current main number for each location, who your phone company is, and whether you prefer to port or to forward. If you choose forwarding, we will send you the numbers to forward to.

7. Three named people

Why: only a small, named group should be able to see call recordings or change the assistant's settings. The privacy rules require us to record who those people are.

How: reply with the name and practice email of:
a. The administrator: the one person who controls the assistant's settings and can view unblanked recordings. Usually the practice owner or office manager.
b. The queue owner: the front-desk person who will pick up requests the assistant could not finish (for example a new patient who wants to book). They will get an email each time and mark it done on a simple web page.
c. The reviewer: the person who will listen to a handful of flagged calls once a month. Can be the same as (a).

8. One question we will ask Retell on your behalf

Why: Retell uses other companies behind the scenes for speech recognition, the language model and voices. We need Retell to confirm in writing which of those are covered by the BAA you signed, so that we only use the covered ones. This is our job, not yours, but you will see the answer and we will file it with your agreements.

How: nothing to do. We will send the question the day your Retell account exists and forward you the reply.

Once items 1 to 4 are done we start building the same day. The plan is 14 working days from that point to a working assistant on your lines, with a document pack for your HIPAA binder at the end.

Thanks,
<our name>
Bytes Platform
<our phone>
bytesuite@bytesplatform.com
