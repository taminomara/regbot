import { EntityDTO, Loaded, LockMode, ref, wrap } from "@mikro-orm/core";
import moment from "moment-timezone";

import { orm } from "#root/backend/data-source.js";
import {
  Event as EventObject,
  EventPayment,
  EventSignup as EventSignupObject,
  SignupStatus,
} from "#root/backend/entities/event.js";
import { User as UserObject, UserStatus } from "#root/backend/entities/user.js";
import { getUserLite } from "#root/backend/user.js";
import { config } from "#root/config.js";
import { logger } from "#root/logger.js";

export { SignupStatus } from "#root/backend/entities/event.js";
export type EventSignup = EntityDTO<EventSignupObject>;
export type PopulatedEventSignup = EntityDTO<
  Loaded<EventSignupObject, "user" | "event">
>;
export type Event = Omit<EntityDTO<EventObject>, "signups">;
export type EventWithSignup = Event & { signup?: EventSignup };
export type EventWithSignups = Event & { signups: EventSignup[] };

export type SignupStats = {
  totalSignups: number;
  pendingSignups: number;
  approvedSignups: number;
};

export async function getEvent(id: number): Promise<Event | null> {
  const event = await orm.em.findOne(EventObject, { id });
  return event === null ? null : wrap(event).toObject();
}

export async function getEventWithSignupStats(
  id: number,
): Promise<(EventWithSignups & SignupStats) | null> {
  const event = await orm.em.findOne(
    EventObject,
    { id },
    { populate: ["signups"] },
  );
  return event === null
    ? null
    : { ...wrap(event).toObject(), ...signupStats(event.signups.getItems()) };
}

export async function signupForEvent(
  event: Event,
  userId: number,
  adminId: number,
  participationOptions: string[] | null,
): Promise<
  | { signup?: EventSignup; signupPerformed: false }
  | { signup: EventSignup; signupPerformed: true }
> {
  const user = await getUserLite(userId);
  if (user.status !== UserStatus.Approved) return { signupPerformed: false };

  const oldSignup = await orm.em.findOne(EventSignupObject, {
    event: event.id,
    user: userId,
  });
  if (oldSignup !== null) {
    return { signup: wrap(oldSignup).toObject(), signupPerformed: false };
  }

  const signup = new EventSignupObject(
    ref(EventObject, event.id),
    ref(UserObject, userId),
    SignupStatus.PendingApproval,
  );

  signup.approvedBy = null;
  signup.approvedAt = null;
  if (event.requireApproval) {
    signup.status = SignupStatus.PendingApproval;
  } else if (event.payment === EventPayment.Required) {
    signup.status = SignupStatus.PendingPayment;
  } else {
    signup.status = SignupStatus.Approved;
    signup.approvedBy = adminId;
    signup.approvedAt = new Date();
  }
  signup.participationOptions = participationOptions;

  await orm.em.persistAndFlush(signup);

  return { signup: wrap(signup).toObject(), signupPerformed: true };
}

export async function withdrawSignup(
  event: Event,
  userId: number,
): Promise<{ requireRefund: boolean; withdrawPerformed: boolean }> {
  return orm.em.transactional(async () => {
    const signup = await orm.em.findOne(
      EventSignupObject,
      {
        event: event.id,
        user: userId,
      },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );

    if (signup !== null) {
      if (signup.status === SignupStatus.Rejected) {
        return { requireRefund: false, withdrawPerformed: false };
      }
      const requireRefund =
        event.payment === EventPayment.Required &&
        signup.status === SignupStatus.Approved;
      orm.em.remove(signup);
      return { requireRefund, withdrawPerformed: true };
    } else {
      return { requireRefund: false, withdrawPerformed: false };
    }
  });
}

export async function confirmSignup(
  event: Event,
  userId: number,
  adminId: number,
): Promise<
  | { signup?: EventSignup; confirmPerformed: false }
  | { signup: EventSignup; confirmPerformed: true }
> {
  return doConfirmSignup(event, userId, adminId, SignupStatus.PendingApproval);
}

export async function confirmPayment(
  event: Event,
  userId: number,
  adminId: number,
): Promise<
  | { signup?: EventSignup; confirmPerformed: false }
  | { signup: EventSignup; confirmPerformed: true }
> {
  return doConfirmSignup(event, userId, adminId, SignupStatus.PendingPayment);
}

async function doConfirmSignup(
  event: Event,
  userId: number,
  adminId: number,
  expectedStatus: SignupStatus,
): Promise<
  | { signup?: EventSignup; confirmPerformed: false }
  | { signup: EventSignup; confirmPerformed: true }
> {
  return orm.em.transactional(async () => {
    const signup = await orm.em.findOne(
      EventSignupObject,
      {
        event: event.id,
        user: userId,
      },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );

    if (signup === null || signup.status !== expectedStatus) {
      return {
        signup: signup === null ? undefined : wrap(signup).toObject(),
        confirmPerformed: false,
      };
    }

    if (signup.status === SignupStatus.PendingApproval) {
      signup.status =
        event.payment === EventPayment.Required
          ? SignupStatus.PendingPayment
          : SignupStatus.Approved;
    } else {
      signup.status = SignupStatus.Approved;
    }
    signup.approvedBy = adminId;
    signup.approvedAt = new Date();

    return {
      signup: wrap(signup).toObject(),
      confirmPerformed: true,
    };
  });
}

export async function rejectSignup(
  event: Event,
  userId: number,
  adminId: number,
): Promise<
  | {
      signup?: EventSignup;
      requireRefund: false;
      rejectPerformed: false;
    }
  | {
      signup: EventSignup;
      requireRefund: boolean;
      rejectPerformed: true;
    }
> {
  return orm.em.transactional(async () => {
    const signup = await orm.em.findOne(
      EventSignupObject,
      {
        event: event.id,
        user: userId,
      },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );

    if (signup === null || signup.status === SignupStatus.Rejected) {
      return {
        signup: signup === null ? undefined : wrap(signup).toObject(),
        rejectPerformed: false,
        requireRefund: false,
      };
    }

    const requireRefund =
      event.payment === EventPayment.Required &&
      signup.status === SignupStatus.Approved;

    signup.status = SignupStatus.Rejected;
    signup.approvedBy = adminId;
    signup.approvedAt = new Date();

    return {
      signup: wrap(signup).toObject(),
      rejectPerformed: true,
      requireRefund,
    };
  });
}

export async function getEventWithUserSignup(
  id: number,
  userId: number,
): Promise<EventWithSignup | null> {
  const event = await orm.em.findOne(
    EventObject,
    { id },
    {
      populate: ["signups"],
      populateWhere: { signups: { user: { id: userId } } },
    },
  );
  if (event === null) return null;
  const dto = wrap(event).toObject();
  return {
    ...dto,
    signup: dto.signups[0],
  };
}

export async function getApprovedEventSignups(
  eventId: number,
): Promise<PopulatedEventSignup[]> {
  return (
    await orm.em.find(
      EventSignupObject,
      { event: eventId, status: SignupStatus.Approved },
      { populate: ["event", "user"], orderBy: { user: { name: "ASC" } } },
    )
  ).map((signup) => wrap(signup).toObject());
}

export async function getEventSignup(
  eventId: number,
  userId: number,
): Promise<PopulatedEventSignup | null> {
  const signup = await orm.em.findOne(
    EventSignupObject,
    { event: eventId, user: userId },
    { populate: ["event", "user"] },
  );
  return signup === null ? null : wrap(signup).toObject();
}

export async function getEventSignups(
  eventId: number,
): Promise<PopulatedEventSignup[]> {
  return (
    await orm.em.find(
      EventSignupObject,
      { event: eventId },
      { populate: ["event", "user"], orderBy: { user: { name: "ASC" } } },
    )
  ).map((signup) => wrap(signup).toObject());
}

export async function createEvent(
  name: string,
  date: Date,
  announceTextHtml: string,
) {
  const event = new EventObject(name, date, announceTextHtml);
  await orm.em.persistAndFlush(event);
  return wrap(event).toObject();
}

export async function upcomingEventsWithSignupStats(): Promise<
  (EventWithSignups & SignupStats)[]
> {
  const events = await orm.em.find(
    EventObject,
    { date: { $gte: new Date() } },
    {
      orderBy: { date: "ASC" },
      populate: ["signups"],
    },
  );
  return events.map((event) => {
    return {
      ...wrap(event).toObject(),
      ...signupStats(event.signups.getItems()),
    };
  });
}

function signupStats(signups: EventSignupObject[]): SignupStats {
  return {
    totalSignups: signups.length,
    pendingSignups: signups.filter((s) =>
      [SignupStatus.PendingPayment, SignupStatus.PendingApproval].includes(
        s.status,
      ),
    ).length,
    approvedSignups: signups.filter((s) => s.status === SignupStatus.Approved)
      .length,
  };
}

export async function upcomingEventsWithUserSignup(
  userId: number,
): Promise<EventWithSignup[]> {
  const events = await orm.em.find(
    EventObject,
    { date: { $gte: new Date() }, visibleInMenu: true },
    {
      orderBy: { date: "ASC" },
      populate: ["signups"],
      populateWhere: { signups: { user: { id: userId } } },
    },
  );
  return events
    .map((event) => wrap(event).toObject())
    .map((event) => {
      return {
        ...event,
        signup: event.signups[0],
      };
    });
}

export async function updateEvent(
  id: number,
  data: Partial<Omit<Event, "id">>,
): Promise<Event> {
  const event = await orm.em.findOneOrFail(EventObject, { id });
  const wrappedEvent = wrap(event);
  wrappedEvent.assign(data);
  return wrappedEvent.toObject();
}

export async function updateEventSignup(
  eventId: number,
  userId: number,
  data: Partial<Omit<EventSignup, "event" | "user">>,
): Promise<EventSignup> {
  const signup = await orm.em.findOneOrFail(EventSignupObject, {
    event: eventId,
    user: userId,
  });
  const wrappedEvent = wrap(signup);
  wrappedEvent.assign(data);
  return wrappedEvent.toObject();
}

export async function deleteEvent(id: number) {
  const event = await orm.em.findOneOrFail(
    EventObject,
    { id },
    { populate: ["signups"] },
  );
  orm.em.remove(event);
}

export async function lockEventForSendingReminders(): Promise<{
  event: Event;
  signups: PopulatedEventSignup[];
} | null> {
  // Days change at `REMINDER_TIME_HH` hours in this routine.
  const today = moment
    .tz(config.TIMEZONE)
    .subtract({ hours: config.REMINDER_TIME_HH })
    .startOf("day");
  // Send reminders for events that will happen between tomorrow 00:00 and...
  const startDate = today.clone().add({ days: 1 });
  // ...3:59AM of the day after after tomorrow.
  const endDate = startDate.clone().add({ days: 1, hours: 3, minutes: 59 });

  logger.debug({
    msg: "Searching events to send reminders",
    startDate: startDate.toDate(),
    endDate: endDate.toDate(),
  });

  return orm.em.transactional(async () => {
    const event = await orm.em.findOne(
      EventObject,
      {
        reminderSent: false,
        published: true,
        cancelled: false,
        date: { $gte: startDate.toDate(), $lte: endDate.toDate() },
      },
      {
        lockMode: LockMode.PESSIMISTIC_WRITE,
        populate: ["signups"],
      },
    );

    if (event === null) {
      return null;
    } else {
      event.reminderSent = true;
      return {
        event,
        signups: (await getEventSignups(event.id)).filter(
          (signup) => signup.status === SignupStatus.Approved,
        ),
      };
    }
  });
}

export async function cancelAllFutureSignupsForUser(userId: number) {
  await orm.em.nativeUpdate(
    EventSignupObject,
    {
      user: userId,
      event: { date: { $gte: new Date() } },
    },
    { status: SignupStatus.Rejected },
  );
}
