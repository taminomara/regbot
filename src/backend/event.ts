import { EntityDTO, Loaded, LockMode, wrap } from "@mikro-orm/core";

import { orm } from "#root/backend/data-source.js";
import {
  Event as EventObject,
  EventSignup as EventSignupObject,
  SignupStatus,
} from "#root/backend/entities/event.js";

export { SignupStatus } from "#root/backend/entities/event.js";
export type EventSignup = EntityDTO<EventSignupObject>;
export type PopulatedEventSignup = EntityDTO<
  Loaded<EventSignupObject, "user" | "event">
>;
export type Event = Omit<EntityDTO<EventObject>, "signups">;
export type EventWithSignup = Event & { signup?: EventSignup };
export type EventWithSignups = Event & { signups: EventSignup[] };

export async function getEvent(id: number): Promise<Event | null> {
  const event = await orm.em.findOne(EventObject, { id });
  return event === null ? null : wrap(event).toObject();
}

export async function signupForEvent(
  event: Event,
  userId: number,
  adminId: number,
): Promise<{ signup: EventSignup; signupPerformed: boolean }> {
  return orm.em.transactional(async () => {
    const oldSignup = await orm.em.findOne(
      EventSignupObject,
      {
        event: event.id,
        user: userId,
      },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    if (oldSignup !== null) {
      return { signup: wrap(oldSignup).toObject(), signupPerformed: false };
    }

    let status: SignupStatus;
    let approvedBy: number | null = null;
    let approvedAt: Date | null = null;
    if (event.requireApproval) {
      status = SignupStatus.PendingApproval;
    } else if (event.requirePayment) {
      status = SignupStatus.PendingPayment;
    } else {
      status = SignupStatus.Approved;
      approvedBy = adminId;
      approvedAt = new Date();
    }

    const signup = await orm.em.upsert(
      EventSignupObject,
      { event: event.id, user: userId, status, approvedBy, approvedAt },
      { onConflictAction: "ignore" },
    );

    return { signup: wrap(signup).toObject(), signupPerformed: true };
  });
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
        event.requirePayment && signup.status === SignupStatus.Approved;
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
  | {
      signup?: EventSignup;
      confirmPerformed: false;
    }
  | {
      signup: EventSignup;
      confirmPerformed: true;
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

    if (
      signup === null ||
      [SignupStatus.Rejected, SignupStatus.Approved].includes(signup.status)
    ) {
      return {
        signup: signup === null ? undefined : wrap(signup).toObject(),
        confirmPerformed: false,
      };
    }

    if (signup.status === SignupStatus.PendingApproval) {
      signup.status = event.requirePayment
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
      event.requirePayment && signup.status === SignupStatus.Approved;

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

export async function getEventSignups(
  eventId: number,
): Promise<PopulatedEventSignup[]> {
  return (
    await orm.em.find(
      EventSignupObject,
      { event: eventId },
      { populate: ["event", "user"] },
    )
  ).map((signup) => wrap(signup).toObject());
}

export async function upcomingEvents(): Promise<Event[]> {
  const events = await orm.em.find(
    EventObject,
    { date: { $gte: new Date() } },
    { orderBy: { date: "ASC" } },
  );
  return events.map((event) => wrap(event).toObject());
}
export async function createEvent(name: string, date: Date) {
  const event = new EventObject(name, date);
  await orm.em.persistAndFlush(event);
  return wrap(event).toObject();
}

export async function upcomingEventsWithSignups(): Promise<EventWithSignups[]> {
  const events = await orm.em.find(
    EventObject,
    { date: { $gte: new Date() } },
    {
      orderBy: { date: "ASC" },
      populate: ["signups"],
      populateOrderBy: { signups: { user: { name: "ASC" } } },
    },
  );
  return events.map((event) => wrap(event).toObject());
}

export async function upcomingEventsWithUserSignup(
  userId: number,
): Promise<EventWithSignup[]> {
  const events = await orm.em.find(
    EventObject,
    { date: { $gte: new Date() } },
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

export async function deleteEvent(id: number) {
  const event = await orm.em.findOneOrFail(
    EventObject,
    { id },
    { populate: ["signups"] },
  );
  orm.em.remove(event);
}
