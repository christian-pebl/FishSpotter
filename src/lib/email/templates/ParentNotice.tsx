import { Text } from "@react-email/components";
import type { ParentalConsentPurpose } from "@/lib/parental-consent-shared";

const P = { fontSize: 14, lineHeight: 1.55, color: "#17252A" } as const;
const H = { ...P, fontWeight: 700 } as const;

/**
 * What a parent is agreeing to, in the words both parent emails use: the
 * request (ParentConsentRequestEmail) and, a day after a yes, the
 * confirmation (ParentConsentConfirmedEmail), which the FTC expects to repeat
 * the original notice. One component, so the two can never drift apart.
 *
 * Covers COPPA 16 CFR 312.4(c)(1)(iii) and (iv): what is collected, how it is
 * used, and who it goes to (nobody; it is never made public).
 */
export function ParentNotice({ purpose }: { purpose: ParentalConsentPurpose }) {
  if (purpose === "prize") {
    return (
      <>
        <Text style={H}>What the prize involves</Text>
        <Text style={P}>
          We email you at this address to ask where to send the book. We post to UK addresses only,
          and postage is free. We use your postal address only to send the book, never for anything
          else, and we never ask your child for it.
        </Text>
        <Text style={H}>Who sees it</Text>
        <Text style={P}>
          Nobody else. We do not sell or share your details or your child&apos;s, there is no
          advertising, and we never publish winners&apos; names. The companies that host
          FishSpotter and send its email store it for us, under contract, and may not use it for
          anything else.
        </Text>
      </>
    );
  }
  return (
    <>
      <Text style={H}>What we keep</Text>
      <Text style={P}>
        Your child&apos;s nickname (picked from names we generate, never their real name), the
        species they identify and when, and their points. We also keep your email address, so that
        you can sign them in on another device and manage their account. We do not collect their
        name, email address, location, photos or any contact details, and there is no audio.
      </Text>
      <Text style={H}>How we use it</Text>
      <Text style={P}>
        To run the game and show your child their own score. Their identifications are also
        combined, without names, into records that help marine scientists. Under-13s are never shown
        on public leaderboards or profiles, cannot post comments, and get no marketing emails. A
        cookie keeps them signed in; it is not used for advertising.
      </Text>
      <Text style={H}>Who sees it</Text>
      <Text style={P}>
        Nobody else, and nothing is made public. We do not sell or share it, and there is no
        advertising. The companies that host FishSpotter and send its email store it for us, under
        contract, and may not use it for anything else.
      </Text>
      <Text style={H}>Your rights</Text>
      <Text style={P}>
        You can see what we hold, download it, stop us collecting more, withdraw your agreement or
        delete the account at any time, from the parent page. If the account is not used for a
        year, we delete it.
      </Text>
    </>
  );
}
